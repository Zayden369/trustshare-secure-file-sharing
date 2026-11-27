"""
LLM Client — TrustShare AI Assistant

Multi-provider wrapper supporting:
- Groq (OpenAI-compatible)
- Google Gemini (OpenAI-compatible endpoint)
- Ollama (local, OpenAI-compatible)
- Any other OpenAI-compatible API
"""

import json
import logging
import time
import os
import atexit
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from src.assistant import config_service

logger = logging.getLogger(__name__)
_http_client = httpx.Client(limits=httpx.Limits(max_connections=4, max_keepalive_connections=2))
atexit.register(_http_client.close)


class LLMError(Exception):
    pass


class LLMNotConfiguredError(LLMError):
    pass


class LLMAPIError(LLMError):
    pass


PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "ollama": "http://localhost:11434/v1",
    "openrouter": "https://openrouter.ai/api/v1",
}

PROVIDERS_REQUIRING_KEY = {"groq", "gemini", "openrouter"}


class LLMClient:

    def __init__(self, db: Session):
        self.db = db
        self._load_config()

    def _load_config(self):

        self.provider = config_service.get_str(self.db, "LLM_PROVIDER", "groq").lower()
        self.api_key = config_service.get(self.db, "LLM_API_KEY")
        self.model = config_service.get_str(
            self.db, "LLM_MODEL", "llama-3.3-70b-versatile"
        )
        self.max_tokens = config_service.get_int(self.db, "LLM_MAX_TOKENS", 1024)
        self.temperature = config_service.get_float(self.db, "LLM_TEMPERATURE", 0.7)
        self.timeout = config_service.get_int(self.db, "LLM_TIMEOUT_SECONDS", 30)

        db_base_url = config_service.get_str(self.db, "LLM_BASE_URL", "")
        self.base_url = db_base_url or PROVIDER_BASE_URLS.get(
            self.provider,
            "https://api.groq.com/openai/v1",
        )

    def is_configured(self) -> bool:

        if self.provider == "ollama":
            return bool(self.base_url)

        return bool(self.api_key)

    def _get_headers(self) -> dict:
        """Get provider-specific request headers."""
        headers = {"Content-Type": "application/json"}

        if self.provider == "ollama":
            return headers

        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        return headers

    def chat_completion(
        self,
        messages: list[dict],
        tools: Optional[list[dict]] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> dict:

        if not self.is_configured():
            raise LLMNotConfiguredError(
                f"LLM provider '{self.provider}' is not properly configured. "
                f"{'Please install Ollama and pull a model.' if self.provider == 'ollama' else 'Configure API key via admin panel.'}"
            )

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.temperature,
            "max_tokens": max_tokens if max_tokens is not None else self.max_tokens,
        }

        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = self._get_headers()

        start = time.perf_counter()
        try:
            response = _http_client.post(
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )
            elapsed_ms = int((time.perf_counter() - start) * 1000)

            if response.status_code != 200:
                raise LLMAPIError(f"LLM API returned {response.status_code}")

            data = response.json()
            choice = data["choices"][0]
            message = choice["message"]

            return {
                "content": message.get("content"),
                "tool_calls": message.get("tool_calls") or [],
                "tokens_used": data.get("usage", {}).get("total_tokens", 0),
                "model_used": data.get("model", self.model),
                "elapsed_ms": elapsed_ms,
                "finish_reason": choice.get("finish_reason"),
                "provider": self.provider,
            }

        except httpx.TimeoutException:
            logger.error(f"{self.provider} request timed out after {self.timeout}s")
            raise LLMAPIError(
                f"{self.provider.capitalize()} request timed out after {self.timeout} seconds"
            )

        except httpx.ConnectError as e:
            logger.error("Cannot reach %s (%s)", self.provider, type(e).__name__)
            if self.provider == "ollama":
                raise LLMAPIError(
                    "Cannot reach Ollama. Make sure Ollama is running: "
                    "run 'ollama serve' in terminal, or install from ollama.com"
                )
            raise LLMAPIError(
                f"Cannot reach {self.provider} API. Check your internet connection."
            )

        except LLMAPIError:
            raise

        except Exception as e:
            logger.error(
                "Unexpected %s error: %s", self.provider, type(e).__name__,
            )
            raise LLMAPIError(f"Unexpected error: {type(e).__name__}")

    async def stream_chat(self, http_client, messages, tools=None, max_tokens=None):
        """Yield upstream tokens, never a typewriter replay of a complete reply."""
        from src.ai_metrics import record_inference, current_trace
        if not self.is_configured():
            raise LLMNotConfiguredError("AI is not configured.")
        native = self.provider == "ollama"
        budget = max(32, min(int(max_tokens or self.max_tokens), 2048))
        if native:
            url = self.base_url.rstrip('/').removesuffix('/v1') + '/api/chat'
            options = {"num_predict": budget, "temperature": self.temperature}
            try:
                threads = int(os.getenv('ASSISTANT_OLLAMA_THREADS', '0'))
            except ValueError:
                threads = 0
            if 1 <= threads <= 64:
                options['num_thread'] = threads
            payload = {"model": self.model, "messages": messages, "stream": True,
                       "keep_alive": "5m", "options": options}
        else:
            url = self.base_url.rstrip('/') + '/chat/completions'
            payload = {"model": self.model, "messages": messages, "stream": True,
                       "temperature": self.temperature, "max_tokens": budget,
                       "stream_options": {"include_usage": True}}
        if tools:
            payload['tools'] = tools
        started = time.perf_counter()
        trace = current_trace.get()
        if trace:
            trace.counters['llm_calls'] += 1
        first = True
        openai_tools = {}
        tokens = 0
        try:
            async with http_client.stream('POST', url, json=payload, headers=self._get_headers(),
                                          timeout=httpx.Timeout(self.timeout, connect=5)) as response:
                if response.status_code != 200:
                    raise LLMAPIError(f"LLM API returned {response.status_code}")
                async for line in response.aiter_lines():
                    if not line or line.startswith(':'):
                        continue
                    if not native:
                        if not line.startswith('data:'):
                            continue
                        line = line[5:].strip()
                        if line == '[DONE]':
                            break
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError as exc:
                        raise LLMAPIError("AI returned an invalid stream.") from exc
                    if data.get('error'):
                        raise LLMAPIError("AI provider could not complete the request.")
                    if native:
                        message = data.get('message', {})
                        content = message.get('content') or ''
                        if content:
                            if first:
                                trace = current_trace.get()
                                if trace:
                                    trace.stages['first_token'] = (time.perf_counter()-started)*1000
                                    trace.stages.setdefault('first_meaningful', (time.perf_counter()-trace.started)*1000)
                                first = False
                            yield {"type": "delta", "text": content}
                        if message.get('tool_calls'):
                            yield {"type": "tools", "calls": message['tool_calls']}
                        if data.get('done'):
                            record_inference(data, (time.perf_counter()-started)*1000, count_call=False)
                            tokens = data.get('eval_count', 0) + data.get('prompt_eval_count', 0)
                            yield {"type": "round_done", "tokens": tokens, "finish_reason": data.get('done_reason')}
                            return
                    else:
                        usage = data.get('usage') or {}
                        tokens = usage.get('total_tokens', tokens)
                        choices = data.get('choices') or []
                        if not choices:
                            continue
                        delta = choices[0].get('delta') or {}
                        if delta.get('content'):
                            if first:
                                trace = current_trace.get()
                                if trace:
                                    trace.stages['first_token'] = (time.perf_counter()-started)*1000
                                    trace.stages.setdefault('first_meaningful', (time.perf_counter()-trace.started)*1000)
                                first = False
                            yield {"type": "delta", "text": delta['content']}
                        for part in delta.get('tool_calls') or []:
                            item = openai_tools.setdefault(part.get('index', 0), {'id':'', 'type':'function','function':{'name':'','arguments':''}})
                            item['id'] += part.get('id') or ''
                            item['function']['name'] += part.get('function', {}).get('name') or ''
                            item['function']['arguments'] += part.get('function', {}).get('arguments') or ''
                if not native:
                    if openai_tools:
                        yield {"type": "tools", "calls": list(openai_tools.values())}
                    record_inference({}, (time.perf_counter()-started)*1000, count_call=False)
                    yield {"type": "round_done", "tokens": tokens}
                    return
                raise LLMAPIError("AI stream ended before completion.")
        except httpx.HTTPError as exc:
            raise LLMAPIError("AI connection interrupted or timed out. Please retry.") from exc

    def generate_conversation_title(self, first_user_message: str) -> str:

        from src.assistant import config_service
        from src.entities.assistant_prompt import AssistantPrompt

        max_length = config_service.get_int(self.db, "LLM_TITLE_MAX_LENGTH", 100)

        if not self.is_configured():
            return first_user_message[: max_length // 2]

        def _get_prompt(key: str, fallback: str) -> str:
            row = (
                self.db.query(AssistantPrompt)
                .filter(
                    AssistantPrompt.prompt_key == key, AssistantPrompt.is_active == True
                )
                .first()
            )
            return row.prompt_text if row else fallback

        system_prompt = _get_prompt(
            "TITLE_GENERATION_SYSTEM",
            "You generate a short 3-5 word title for a chat conversation. "
            "Return ONLY the title, no quotes, no punctuation, no explanation.",
        )
        user_prompt_template = _get_prompt(
            "TITLE_GENERATION_USER",
            "Generate a title for this message: {message}",
        )
        user_prompt = user_prompt_template.replace("{message}", first_user_message)

        try:
            result = self.chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.3,
                max_tokens=20,
            )
            title = (result.get("content") or "").strip().strip('"').strip("'")
            return (
                title[:max_length] if title else first_user_message[: max_length // 2]
            )
        except Exception as e:
            logger.warning(f"Title generation failed: {e}")
            return first_user_message[: max_length // 2]
