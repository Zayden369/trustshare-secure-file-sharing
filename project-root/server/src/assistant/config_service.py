"""
Assistant Config Service — TrustShare AI Assistant

Central service for reading/writing assistant configs.
Handles:
- Type casting (string → int/float/bool/json)
- Secret encryption/decryption
- In-memory caching with TTL
- Category grouping

All modules should use this service, never query the DB directly.
"""

import json
import logging
import time
from typing import Any, Optional
from threading import Lock

from sqlalchemy.orm import Session

from src.entities.assistant_config import AssistantConfig
from src.assistant.encryption_helper import (
    encrypt_config_value,
    decrypt_config_value,
    mask_secret,
    is_encrypted,
)

logger = logging.getLogger(__name__)

_cache: dict[str, Any] = {}
_cache_timestamp: float = 0
_cache_lock = Lock()
DEFAULT_CACHE_TTL_SECONDS = 60

# TYPE CASTING


def _cast_value(raw_value: Optional[str], config_type: str) -> Any:
    """Cast raw string value from DB to the intended Python type."""
    if raw_value is None:
        return None

    try:
        if config_type == "integer":
            return int(raw_value)
        elif config_type == "float":
            return float(raw_value)
        elif config_type == "boolean":
            return raw_value.strip().lower() in ("true", "1", "yes", "on")
        elif config_type == "json":
            return json.loads(raw_value)
        else:  # "string" or fallback
            return raw_value
    except (ValueError, json.JSONDecodeError) as e:
        logger.warning(
            f"Type cast failed for {config_type}: {e}. Returning raw string."
        )
        return raw_value


# CACHE MANAGEMENT


def _refresh_cache(db: Session) -> None:
    """Rebuild in-memory cache from DB."""
    global _cache, _cache_timestamp

    with _cache_lock:
        rows = db.query(AssistantConfig).filter(AssistantConfig.is_active == True).all()

        new_cache = {}
        for row in rows:
            try:
                raw_value = row.config_value

                if row.is_secret and raw_value:
                    try:
                        raw_value = decrypt_config_value(raw_value)
                    except Exception as e:
                        logger.error(
                            f"Failed to decrypt {row.config_key}: {type(e).__name__}"
                        )
                        raw_value = None

                new_cache[row.config_key] = _cast_value(raw_value, row.config_type)
            except Exception as e:
                logger.error(f"Cache build error for {row.config_key}: {e}")

        _cache = new_cache
        _cache_timestamp = time.time()
        logger.debug(f"Assistant config cache refreshed: {len(_cache)} entries")


def _ensure_cache_fresh(db: Session) -> None:
    """Refresh cache if TTL expired or empty. TTL loaded from DB config."""
    now = time.time()

    ttl = (
        _cache.get("CONFIG_CACHE_TTL_SECONDS", DEFAULT_CACHE_TTL_SECONDS)
        if _cache
        else DEFAULT_CACHE_TTL_SECONDS
    )
    try:
        ttl = int(ttl)
    except (ValueError, TypeError):
        ttl = DEFAULT_CACHE_TTL_SECONDS

    if not _cache or (now - _cache_timestamp) > ttl:
        _refresh_cache(db)


def clear_cache() -> None:
    """Force cache clear (called after admin updates)."""
    global _cache, _cache_timestamp
    with _cache_lock:
        _cache = {}
        _cache_timestamp = 0


# PUBLIC READ API


def get(db: Session, key: str, default: Any = None) -> Any:
    """Get a config value with automatic type casting."""
    _ensure_cache_fresh(db)
    return _cache.get(key, default)


def get_str(db: Session, key: str, default: str = "") -> str:
    """Get a string config."""
    value = get(db, key, default)
    return str(value) if value is not None else default


def get_int(db: Session, key: str, default: int = 0) -> int:
    """Get an integer config."""
    value = get(db, key, default)
    try:
        return int(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def get_float(db: Session, key: str, default: float = 0.0) -> float:
    """Get a float config."""
    value = get(db, key, default)
    try:
        return float(value) if value is not None else default
    except (ValueError, TypeError):
        return default


def get_bool(db: Session, key: str, default: bool = False) -> bool:
    """Get a boolean config."""
    value = get(db, key, default)
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in ("true", "1", "yes", "on")


def get_all_by_category(db: Session, category: str) -> list[dict]:

    rows = (
        db.query(AssistantConfig)
        .filter(
            AssistantConfig.category == category,
            AssistantConfig.is_active == True,
        )
        .order_by(AssistantConfig.display_order)
        .all()
    )

    result = []
    for row in rows:
        raw_value = row.config_value

        actual_value = raw_value
        if row.is_secret and raw_value:
            try:
                actual_value = decrypt_config_value(raw_value)
            except Exception:
                actual_value = None

        if row.is_secret:
            display_value = mask_secret(raw_value) if raw_value else "Not configured"
            api_value = None
        else:
            display_value = raw_value or ""
            api_value = _cast_value(raw_value, row.config_type)

        result.append(
            {
                "key": row.config_key,
                "value": api_value,
                "display_value": display_value,
                "type": row.config_type,
                "description": row.description,
                "is_secret": row.is_secret,
                "is_editable": row.is_editable,
                "is_configured": bool(actual_value),
                "category": row.category,
                "display_order": row.display_order,
            }
        )

    return result


def is_assistant_configured(db: Session) -> bool:
    """
    Check if assistant is ready to use.
    Requires enabled state and provider-specific configuration.
    """
    if not get_bool(db, "ENABLE_ASSISTANT", False):
        return False

    if get_str(db, 'LLM_PROVIDER', 'groq').strip().lower() == 'ollama':
        return bool(get_str(db, 'LLM_BASE_URL', '').strip())

    api_key = get(db, "LLM_API_KEY")
    return bool(api_key)


# PUBLIC WRITE API (Admin only)


def set_value(db: Session, key: str, new_value: Any) -> AssistantConfig:
    """
    Update a config value. Automatically encrypts if is_secret=True.

    Args:
        db: DB session
        key: Config key
        new_value: New value (any type — will be stringified)

    Returns:
        Updated AssistantConfig row

    Raises:
        ValueError: If config doesn't exist or is not editable
    """
    config = db.query(AssistantConfig).filter(AssistantConfig.config_key == key).first()

    if not config:
        raise ValueError(f"Config key '{key}' not found")

    if not config.is_editable:
        raise ValueError(f"Config key '{key}' is not editable")

    if new_value is None or new_value == "":
        storage_value = None
    elif config.config_type == "json":
        storage_value = json.dumps(new_value)
    elif config.config_type == "boolean":
        storage_value = "true" if bool(new_value) else "false"
    else:
        storage_value = str(new_value)

    if config.is_secret and storage_value:
        storage_value = encrypt_config_value(storage_value)

    config.config_value = storage_value
    db.commit()
    db.refresh(config)

    # Invalidate cache
    clear_cache()

    logger.info(
        f"Config updated: {key} " f"({'secret' if config.is_secret else 'plain'})"
    )

    return config
