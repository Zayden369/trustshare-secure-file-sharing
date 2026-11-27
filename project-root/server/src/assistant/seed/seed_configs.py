"""
Seed default AI Assistant configs.

Only inserts missing configs. Existing configs are left untouched.
Admin sets actual values (like API key) via the admin UI.
"""

import logging
from sqlalchemy.orm import Session

from src.entities.assistant_config import AssistantConfig

logger = logging.getLogger(__name__)


DEFAULT_CONFIGS = [
    {
        "config_key": "AI_REQUEST_DEADLINE_SECONDS",
        "config_value": "75",
        "config_type": "integer",
        "description": "Overall custom AI turn deadline, including queue and tools (clamped to 10-120 seconds)",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 8,
    },
    # LLM Provider Configs
    {
        "config_key": "LLM_PROVIDER",
        "config_value": "groq",
        "config_type": "string",
        "description": "AI model provider (currently supports: groq)",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 1,
    },
    {
        "config_key": "LLM_MODEL",
        "config_value": "llama-3.3-70b-versatile",
        "config_type": "string",
        "description": "Model name to use for chat completions",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 2,
    },
    {
        "config_key": "LLM_API_KEY",
        "config_value": None,  # Admin sets this via UI
        "config_type": "string",
        "description": "API key for the LLM provider (encrypted at rest)",
        "is_secret": True,
        "is_editable": True,
        "category": "llm",
        "display_order": 3,
    },
    {
        "config_key": "LLM_BASE_URL",
        "config_value": "https://api.groq.com/openai/v1",
        "config_type": "string",
        "description": "Base URL for LLM API (Groq uses OpenAI-compatible endpoint)",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 4,
    },
    {
        "config_key": "LLM_MAX_TOKENS",
        "config_value": "1024",
        "config_type": "integer",
        "description": "Maximum tokens in LLM response",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 5,
    },
    {
        "config_key": "LLM_TEMPERATURE",
        "config_value": "0.7",
        "config_type": "float",
        "description": "LLM creativity (0.0=deterministic, 1.0=creative)",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 6,
    },
    {
        "config_key": "LLM_TIMEOUT_SECONDS",
        "config_value": "30",
        "config_type": "integer",
        "description": "Max seconds to wait for LLM response",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 7,
    },
    {
        "config_key": "LLM_TEST_SYSTEM_MESSAGE",
        "config_value": "You are a test bot.",
        "config_type": "string",
        "description": "System message sent when admin tests LLM connection",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 12,
    },
    {
        "config_key": "LLM_AVAILABLE_PROVIDERS",
        "config_value": '[{"value":"groq","label":"Groq (Cloud, Fast)","base_url":"https://api.groq.com/openai/v1","requires_key":true,"description":"Free tier: 100K tokens/day per model"},{"value":"gemini","label":"Google Gemini (Cloud, Large Quota)","base_url":"https://generativelanguage.googleapis.com/v1beta/openai","requires_key":true,"description":"Free tier: 1500 requests/day, 1M tokens/min"},{"value":"ollama","label":"Ollama (Local, Unlimited)","base_url":"http://localhost:11434/v1","requires_key":false,"description":"Runs locally, no API limits, requires installation"}]',
        "config_type": "json",
        "description": "Available AI providers admin can choose from",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 0,
    },
    {
        "config_key": "LLM_MODELS_BY_PROVIDER",
        "config_value": '{"groq":[{"value":"llama-3.3-70b-versatile","label":"Llama 3.3 70B (Recommended)"},{"value":"llama-3.1-8b-instant","label":"Llama 3.1 8B (Fastest)"},{"value":"mixtral-8x7b-32768","label":"Mixtral 8x7B (Long Context)"},{"value":"gemma2-9b-it","label":"Gemma 2 9B"},{"value":"deepseek-r1-distill-llama-70b","label":"DeepSeek R1 70B (Reasoning)"}],"gemini":[{"value":"gemini-2.0-flash","label":"Gemini 2.0 Flash (Recommended)"},{"value":"gemini-2.0-flash-lite","label":"Gemini 2.0 Flash Lite (Fastest)"},{"value":"gemini-1.5-flash","label":"Gemini 1.5 Flash"},{"value":"gemini-1.5-flash-8b","label":"Gemini 1.5 Flash 8B"},{"value":"gemini-1.5-pro","label":"Gemini 1.5 Pro (Best Quality)"}],"ollama":[{"value":"llama3.1","label":"Llama 3.1 8B (Recommended, needs function calling)"},{"value":"llama3.1:70b","label":"Llama 3.1 70B (Best quality, needs 40GB RAM)"},{"value":"qwen2.5","label":"Qwen 2.5 7B (Great for function calling)"},{"value":"mistral","label":"Mistral 7B (Fast)"},{"value":"gemma2","label":"Gemma 2 9B"}]}',
        "config_type": "json",
        "description": "Available models organized by provider",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 8,
    },
    {
        "config_key": "LLM_AVAILABLE_MODELS",
        "config_value": '[{"value":"llama-3.3-70b-versatile","label":"Llama 3.3 70B (Recommended)"},{"value":"llama-3.1-8b-instant","label":"Llama 3.1 8B (Fastest)"},{"value":"mixtral-8x7b-32768","label":"Mixtral 8x7B (Long Context)"},{"value":"gemma2-9b-it","label":"Gemma 2 9B"},{"value":"deepseek-r1-distill-llama-70b","label":"DeepSeek R1 70B (Reasoning)"}]',
        "config_type": "json",
        "description": "List of models available for admin to choose from (JSON array of {value, label})",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 8,
    },
    {
        "config_key": "ENABLE_MARKDOWN",
        "config_value": "true",
        "config_type": "boolean",
        "description": "Render markdown formatting in assistant responses",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 26,
    },
    {
        "config_key": "SHOW_TOKEN_USAGE",
        "config_value": "false",
        "config_type": "boolean",
        "description": "Show token usage below each assistant message",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 27,
    },
    {
        "config_key": "LLM_TITLE_MAX_LENGTH",
        "config_value": "100",
        "config_type": "integer",
        "description": "Max characters for auto-generated conversation title",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 9,
    },
    {
        "config_key": "LLM_TEST_MESSAGE",
        "config_value": "Reply with exactly: OK",
        "config_type": "string",
        "description": "Message sent to LLM when admin tests connection",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 10,
    },
    {
        "config_key": "LLM_TEST_MAX_TOKENS",
        "config_value": "5",
        "config_type": "integer",
        "description": "Max tokens for LLM connection test response",
        "is_secret": False,
        "is_editable": True,
        "category": "llm",
        "display_order": 11,
    },
    # Rate Limiting Configs
    {
        "config_key": "RATE_LIMIT_PER_MINUTE",
        "config_value": "20",
        "config_type": "integer",
        "description": "Max chat messages per user per minute",
        "is_secret": False,
        "is_editable": True,
        "category": "rate_limit",
        "display_order": 10,
    },
    {
        "config_key": "MAX_MESSAGE_LENGTH",
        "config_value": "2000",
        "config_type": "integer",
        "description": "Max characters per user message",
        "is_secret": False,
        "is_editable": True,
        "category": "rate_limit",
        "display_order": 11,
    },
    {
        "config_key": "CONVERSATION_HISTORY_LIMIT",
        "config_value": "10",
        "config_type": "integer",
        "description": "Number of past messages to include in LLM context",
        "is_secret": False,
        "is_editable": True,
        "category": "rate_limit",
        "display_order": 12,
    },
    {
        "config_key": "MAX_FUNCTION_CALL_ITERATIONS",
        "config_value": "5",
        "config_type": "integer",
        "description": "Safety limit: max function calls in one chat turn (prevents infinite loops)",
        "is_secret": False,
        "is_editable": True,
        "category": "rate_limit",
        "display_order": 13,
    },
    {
        "config_key": "DEFAULT_FUNCTION_LIMIT",
        "config_value": "10",
        "config_type": "integer",
        "description": "Default number of items returned by list functions (list_files, notifications)",
        "is_secret": False,
        "is_editable": True,
        "category": "rate_limit",
        "display_order": 14,
    },
    {
        "config_key": "MAX_FUNCTION_LIMIT",
        "config_value": "50",
        "config_type": "integer",
        "description": "Maximum items a single function can return (upper cap)",
        "is_secret": False,
        "is_editable": True,
        "category": "rate_limit",
        "display_order": 15,
    },
    {
        "config_key": "CONFIG_CACHE_TTL_SECONDS",
        "config_value": "60",
        "config_type": "integer",
        "description": "How long assistant configs are cached in memory (seconds)",
        "is_secret": False,
        "is_editable": True,
        "category": "system",
        "display_order": 101,
    },
    # UI Configs
    {
        "config_key": "ENABLE_ASSISTANT",
        "config_value": "true",
        "config_type": "boolean",
        "description": "Master switch to enable/disable the AI Assistant",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 20,
    },
    {
        "config_key": "ENABLE_BUBBLE",
        "config_value": "true",
        "config_type": "boolean",
        "description": "Show floating chat bubble on all pages",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 21,
    },
    {
        "config_key": "BOT_NAME",
        "config_value": "TrustShare Assistant",
        "config_type": "string",
        "description": "Display name of the chatbot",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 22,
    },
    {
        "config_key": "BOT_TAGLINE",
        "config_value": "AI-powered file assistant",
        "config_type": "string",
        "description": "Short tagline shown under bot name",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 23,
    },
    {
        "config_key": "BOT_AVATAR_ICON",
        "config_value": "Sparkles",
        "config_type": "string",
        "description": "Lucide icon name for bot avatar",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 24,
    },
    {
        "config_key": "SHOW_SUGGESTED_QUERIES",
        "config_value": "true",
        "config_type": "boolean",
        "description": "Show suggested query buttons at start of conversation",
        "is_secret": False,
        "is_editable": True,
        "category": "ui",
        "display_order": 25,
    },
    # System Configs (not editable by admin)
    {
        "config_key": "SCHEMA_VERSION",
        "config_value": "1",
        "config_type": "integer",
        "description": "Assistant module schema version",
        "is_secret": False,
        "is_editable": False,
        "category": "system",
        "display_order": 100,
    },
]


def seed_configs(db: Session) -> int:
    """
    Insert missing configs. Returns count of rows added.
    """
    added = 0

    for cfg_data in DEFAULT_CONFIGS:
        existing = (
            db.query(AssistantConfig)
            .filter(AssistantConfig.config_key == cfg_data["config_key"])
            .first()
        )

        if existing:
            continue

        config = AssistantConfig(**cfg_data)
        db.add(config)
        added += 1

    if added > 0:
        db.commit()

    return added
