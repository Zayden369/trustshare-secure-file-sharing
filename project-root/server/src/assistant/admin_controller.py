"""
Assistant Admin Controller — TrustShare AI Assistant

Admin-only endpoints for managing AI assistant configuration.
"""

import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from src.auth.dependencies import require_admin
from src.database.core import get_db
from src.entities.user import User

from src.assistant import config_service
from src.assistant.encryption_helper import decrypt_config_value
from datetime import datetime, timedelta, timezone
from src.assistant.models import (
    BulkUpdateConfigsRequest,
    ConfigCategoryOut,
    ConfigItemOut,
    ConfigUpdateResult,
    TestConnectionRequest,
    TestConnectionResponse,
    UpdateConfigRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


from pydantic import BaseModel, ConfigDict, Field


class SuggestionIntentRequest(BaseModel):
    model_config=ConfigDict(extra='forbid')
    intent_id: Optional[str]=Field(default=None,max_length=64)


@router.patch('/suggestions/{suggestion_id}/intent')
def set_suggestion_intent(suggestion_id:int,body:SuggestionIntentRequest,
                          db:Session=Depends(get_db),_admin:User=Depends(require_admin)):
    from src.entities.assistant_suggested_query import AssistantSuggestedQuery, AssistantSuggestionIntent
    from src.assistant.intents import BY_ID, BY_TEXT, normalize
    suggestion=db.get(AssistantSuggestedQuery,suggestion_id)
    if not suggestion:raise HTTPException(404,'Suggestion not found.')
    if body.intent_id is not None and body.intent_id not in BY_ID:
        raise HTTPException(400,'Only a registered read-only intent can be selected.')
    canonical=BY_TEXT.get(normalize(suggestion.query_text))
    if body.intent_id and canonical and canonical.id!=body.intent_id:
        raise HTTPException(400,'The mapping conflicts with this known question.')
    mapping=db.get(AssistantSuggestionIntent,suggestion_id)
    if body.intent_id is None:
        if mapping:db.delete(mapping)
    elif mapping:
        mapping.intent_id=body.intent_id
    else:db.add(AssistantSuggestionIntent(suggestion_id=suggestion_id,intent_id=body.intent_id))
    db.commit()
    return {'suggestion_id':suggestion_id,'intent_id':body.intent_id}

# ── Live Model Fetcher (all providers, cached 1hr, safe fallback) ─────────
_live_models_cache: dict = {}
_LIVE_MODELS_CACHE_TTL_SECONDS = 3600  # 1 hour


def _fetch_groq_models(base_url: str, api_key: Optional[str], timeout: int) -> list[dict]:
    """Fetch and filter Groq models. Only text-chat models supporting tools."""
    if not api_key:
        raise ValueError("Groq requires an API key")

    url = f"{base_url.rstrip('/')}/models"
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    response = httpx.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    raw_models = response.json().get("data", [])
    filtered = []

    for m in raw_models:
        if not m.get("active"):
            continue

        input_mods = m.get("input_modalities") or ["text"]
        output_mods = m.get("output_modalities") or ["text"]
        if "text" not in input_mods or "text" not in output_mods:
            continue

        features = m.get("supported_features") or []
        if "tools" not in features:
            continue

        model_id = m.get("id")
        if not model_id:
            continue

        display_name = m.get("name") or model_id
        filtered.append({"value": model_id, "label": display_name})

    return filtered


def _fetch_gemini_models(base_url: str, api_key: Optional[str], timeout: int) -> list[dict]:
    """
    Fetch Gemini models via native API (not OpenAI-compat endpoint).
    Only models that support 'generateContent' method.
    """
    if not api_key:
        raise ValueError("Gemini requires an API key")

    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    response = httpx.get(url, timeout=timeout)
    response.raise_for_status()

    raw_models = response.json().get("models", [])
    filtered = []

    skip_patterns = ["embed", "aqa", "tts", "learnlm", "imagen", "veo"]

    for m in raw_models:
        supported = m.get("supportedGenerationMethods") or []
        if "generateContent" not in supported:
            continue

        name = m.get("name", "")
        model_id = name.replace("models/", "") if name.startswith("models/") else name

        if not model_id:
            continue

        if any(pat in model_id.lower() for pat in skip_patterns):
            continue

        display_name = m.get("displayName") or model_id
        filtered.append({"value": model_id, "label": display_name})

    return filtered


def _fetch_ollama_models(base_url: str, api_key: Optional[str], timeout: int) -> list[dict]:
    """
    Fetch installed Ollama models via native /api/tags endpoint.
    No API key needed. Returns models the user has actually pulled locally.
    """
    root = base_url.rstrip("/")
    if root.endswith("/v1"):
        root = root[:-3]

    url = f"{root}/api/tags"
    response = httpx.get(url, timeout=timeout)
    response.raise_for_status()

    raw_models = response.json().get("models", [])
    filtered = []

    for m in raw_models:
        model_id = m.get("name")
        if not model_id:
            continue

        details = m.get("details") or {}
        family = details.get("family", "")
        param_size = details.get("parameter_size", "")

        label_parts = [model_id]
        if family or param_size:
            extra = " · ".join([x for x in [family, param_size] if x])
            label_parts.append(f"({extra})")

        filtered.append({
            "value": model_id,
            "label": " ".join(label_parts),
        })

    return filtered


_PROVIDER_FETCHERS = {
    "groq": _fetch_groq_models,
    "gemini": _fetch_gemini_models,
    "ollama": _fetch_ollama_models,
}


def _fetch_live_models(
    provider: str,
    base_url: str,
    api_key: Optional[str],
    timeout: int = 10,
) -> list[dict]:
    """Route to correct provider fetcher. Raises on any failure."""
    fetcher = _PROVIDER_FETCHERS.get(provider)
    if not fetcher:
        raise ValueError(f"No live fetcher available for provider '{provider}'")
    return fetcher(base_url, api_key, timeout)

CATEGORIES = ["llm", "rate_limit", "ui", "system"]


@router.get("/config", response_model=list[ConfigCategoryOut])
def get_all_configs(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = []
    for cat in CATEGORIES:
        items = config_service.get_all_by_category(db, cat)
        if items:
            result.append(ConfigCategoryOut(category=cat, items=items))
    return result


@router.get("/config/{category}", response_model=list[ConfigItemOut])
def get_configs_by_category(
    category: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if category not in CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown category: {category}",
        )
    return config_service.get_all_by_category(db, category)


@router.put("/config/{key}", response_model=ConfigUpdateResult)
def update_config(
    key: str,
    body: UpdateConfigRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    try:
        config_service.set_value(db, key, body.value)
        return ConfigUpdateResult(
            status="success",
            message=f"Config '{key}' updated successfully",
            updated_key=key,
            updated_count=1,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Config update failed for {key}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update config",
        )


@router.post("/config/bulk", response_model=ConfigUpdateResult)
def bulk_update_configs(
    body: BulkUpdateConfigsRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    errors = []
    success = 0

    for key, value in body.updates.items():
        try:
            config_service.set_value(db, key, value)
            success += 1
        except ValueError as e:
            errors.append(f"{key}: {e}")
        except Exception as e:
            logger.error(f"Bulk update failed for {key}: {e}")
            errors.append(f"{key}: internal error")

    if errors and success == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "All updates failed", "errors": errors},
        )

    return ConfigUpdateResult(
        status="success" if not errors else "partial",
        message=f"Updated {success} configs"
        + (f", {len(errors)} failed" if errors else ""),
        updated_count=success,
    )


@router.post("/test-connection", response_model=TestConnectionResponse)
def test_connection(
    body: TestConnectionRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Test connection to the LLM provider."""
    provider = config_service.get_str(db, "LLM_PROVIDER", "groq")
    base_url = config_service.get_str(
        db, "LLM_BASE_URL", "https://api.groq.com/openai/v1"
    )
    timeout = config_service.get_int(db, "LLM_TIMEOUT_SECONDS", 30)

    if body.api_key:
        api_key = body.api_key.strip()
    else:
        api_key = config_service.get(db, "LLM_API_KEY")

    if not api_key:
        return TestConnectionResponse(
            success=False,
            message="No API key configured. Save an API key first, or provide one to test.",
            error_type="no_api_key",
        )

    model = body.model or config_service.get_str(
        db, "LLM_MODEL", "llama-3.3-70b-versatile"
    )

    test_message = config_service.get_str(
        db, "LLM_TEST_MESSAGE", "Reply with exactly: OK"
    )
    test_system_message = config_service.get_str(
        db, "LLM_TEST_SYSTEM_MESSAGE", "You are a test bot."
    )
    test_max_tokens = config_service.get_int(db, "LLM_TEST_MAX_TOKENS", 5)

    start = time.time()
    try:
        provider_normalized = provider.strip().lower()

        if provider_normalized == "gemini":
            model_path = model if model.startswith("models/") else f"models/{model}"
            gemini_url = (
                f"https://generativelanguage.googleapis.com/v1beta/"
                f"{model_path}:generateContent?key={api_key}"
            )
            response = httpx.post(
                gemini_url,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [
                        {
                            "role": "user",
                            "parts": [{"text": test_message}],
                        }
                    ],
                    "generationConfig": {
                        "maxOutputTokens": max(test_max_tokens, 10),
                        "temperature": 0,
                    },
                    "systemInstruction": {
                        "parts": [{"text": test_system_message}],
                    },
                },
                timeout=timeout,
            )
        else:
            response = httpx.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": test_system_message},
                        {"role": "user", "content": test_message},
                    ],
                    "max_tokens": test_max_tokens,
                    "temperature": 0,
                },
                timeout=timeout,
            )

        elapsed_ms = int((time.time() - start) * 1000)

        # Log the response for debugging
        logger.info(f"[TEST-CONNECTION] Status: {response.status_code}")
        logger.info(f"[TEST-CONNECTION] Body: {response.text[:300]}")

        if response.status_code == 200:
            data = response.json()
            model_used = data.get("model", model)
            return TestConnectionResponse(
                success=True,
                message=f"Connected successfully! Provider: {provider}",
                model_used=model_used,
                response_time_ms=elapsed_ms,
            )

        error_detail = response.text[:200] if response.text else "Unknown error"

        if response.status_code == 401:
            return TestConnectionResponse(
                success=False,
                message="Invalid API key. Please check your key and try again.",
                error_type="invalid_api_key",
                response_time_ms=elapsed_ms,
            )
        elif response.status_code == 404:
            return TestConnectionResponse(
                success=False,
                message=f"Model '{model}' not found. Check model name.",
                error_type="model_not_found",
                response_time_ms=elapsed_ms,
            )
        elif response.status_code == 429:
            return TestConnectionResponse(
                success=False,
                message=f"Rate limit exceeded on the LLM provider. Details: {error_detail}",
                error_type="rate_limited",
                response_time_ms=elapsed_ms,
            )
        else:
            return TestConnectionResponse(
                success=False,
                message=f"API returned {response.status_code}: {error_detail}",
                error_type=f"http_{response.status_code}",
                response_time_ms=elapsed_ms,
            )

    except httpx.ConnectError:
        return TestConnectionResponse(
            success=False,
            message="Cannot reach LLM provider. Check your internet or base URL.",
            error_type="connection_error",
        )
    except httpx.TimeoutException:
        return TestConnectionResponse(
            success=False,
            message=f"Request timed out after {timeout}s. Try a smaller model or increase timeout.",
            error_type="timeout",
        )
    except Exception as e:
        logger.error(f"Connection test failed: {e}", exc_info=True)
        return TestConnectionResponse(
            success=False,
            message=f"Unexpected error: {type(e).__name__}",
            error_type="unknown",
        )


@router.post("/cache/clear")
def clear_cache(
    _admin: User = Depends(require_admin),
):
    config_service.clear_cache()
    return {"status": "success", "message": "Cache cleared"}


@router.get("/models")
def get_available_models(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    models = config_service.get(db, "LLM_AVAILABLE_MODELS")
    if not models or not isinstance(models, list):
        return [
            {
                "value": "llama-3.3-70b-versatile",
                "label": "Llama 3.3 70B (Recommended)",
            },
        ]
    return models


@router.get("/providers")
def get_available_providers(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    providers = config_service.get(db, "LLM_AVAILABLE_PROVIDERS")
    if not providers or not isinstance(providers, list):
        return [
            {
                "value": "groq",
                "label": "Groq (Cloud, Fast)",
                "base_url": "https://api.groq.com/openai/v1",
                "requires_key": True,
                "description": "Free tier: 100K tokens/day per model",
            }
        ]
    return providers


@router.get("/models/{provider}")
def get_models_for_provider(
    provider: str,
    live: bool = False,
    refresh: bool = False,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
  
    def _db_list() -> list[dict]:
        all_models = config_service.get(db, "LLM_MODELS_BY_PROVIDER")
        if not all_models or not isinstance(all_models, dict):
            return []
        return all_models.get(provider, [])

    if not live:
        return _db_list()

    provider_normalized = (provider or "").strip().lower()
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    cache_entry = _live_models_cache.get(provider_normalized)
    if not refresh and cache_entry and cache_entry["expires_at"] > now:
        return {
            "models": cache_entry["models"],
            "source": "cache",
            "fetched_at": cache_entry["fetched_at"].isoformat(),
        }

    providers = config_service.get(db, "LLM_AVAILABLE_PROVIDERS") or []
    provider_config = next(
        (p for p in providers if p.get("value") == provider_normalized), None
    )
    base_url = provider_config.get("base_url") if provider_config else None

    if not base_url:
        base_url = {
            "groq":   "https://api.groq.com/openai/v1",
            "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
            "ollama": "http://localhost:11434/v1",
        }.get(provider_normalized)

    if not base_url:
        return {
            "models": _db_list(),
            "source": "db_fallback",
            "error": f"No base URL configured for '{provider_normalized}'",
        }

    api_key = None
    current_provider = config_service.get_str(db, "LLM_PROVIDER", "").lower()
    if current_provider == provider_normalized:
        api_key = config_service.get(db, "LLM_API_KEY")

    try:
        models = _fetch_live_models(
            provider=provider_normalized,
            base_url=base_url,
            api_key=api_key,
            timeout=10,
        )

        if not models:
            raise ValueError("Provider returned no usable models")

        _live_models_cache[provider_normalized] = {
            "models": models,
            "expires_at": now + timedelta(seconds=_LIVE_MODELS_CACHE_TTL_SECONDS),
            "fetched_at": now,
        }

        return {
            "models": models,
            "source": "live",
            "fetched_at": now.isoformat(),
        }

    except httpx.ConnectError:
        logger.warning(f"Cannot reach {provider_normalized} at {base_url}")
        return {
            "models": _db_list(),
            "source": "db_fallback",
            "error": (
                "Cannot reach Ollama. Make sure 'ollama serve' is running."
                if provider_normalized == "ollama"
                else f"Cannot reach {provider_normalized} API. Check internet connection."
            ),
        }

    except httpx.TimeoutException:
        logger.warning(f"Timeout fetching {provider_normalized} models")
        return {
            "models": _db_list(),
            "source": "db_fallback",
            "error": f"{provider_normalized.capitalize()} API timed out. Using saved list.",
        }

    except ValueError as e:
        logger.info(f"Live fetch skipped for {provider_normalized}: {e}")
        return {
            "models": _db_list(),
            "source": "db_fallback",
            "error": str(e),
        }

    except Exception as e:
        logger.warning(
            f"Live model fetch failed for {provider_normalized}: "
            f"{type(e).__name__}: {e}"
        )
        return {
            "models": _db_list(),
            "source": "db_fallback",
            "error": f"Live fetch failed ({type(e).__name__}). Using saved list.",
        }
@router.post("/switch-provider")
def switch_provider(
    body: dict,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    new_provider = (body.get("provider") or "").strip().lower()
    new_model = body.get("model")
    new_api_key = body.get("api_key")

    if not new_provider:
        raise HTTPException(status_code=400, detail="'provider' is required")

    providers = config_service.get(db, "LLM_AVAILABLE_PROVIDERS") or []
    provider_config = next(
        (p for p in providers if p.get("value") == new_provider), None
    )

    if not provider_config:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider '{new_provider}'. Available: {[p['value'] for p in providers]}",
        )

    if not new_model:
        all_models = config_service.get(db, "LLM_MODELS_BY_PROVIDER") or {}
        provider_models = all_models.get(new_provider, [])
        if provider_models:
            new_model = provider_models[0].get("value")

    if not new_model:
        raise HTTPException(
            status_code=400,
            detail=f"No default model available for '{new_provider}'",
        )

    try:
        config_service.set_value(db, "LLM_PROVIDER", new_provider)
        config_service.set_value(
            db, "LLM_BASE_URL", provider_config.get("base_url", "")
        )
        config_service.set_value(db, "LLM_MODEL", new_model)

        if new_api_key:
            config_service.set_value(db, "LLM_API_KEY", new_api_key)

        return {
            "status": "success",
            "message": f"Switched to {provider_config.get('label', new_provider)}",
            "provider": new_provider,
            "model": new_model,
            "base_url": provider_config.get("base_url"),
            "requires_key": provider_config.get("requires_key", True),
        }
    except Exception as e:
        logger.error(f"Provider switch failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Provider switch failed: {str(e)}")
