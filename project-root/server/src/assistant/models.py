"""
Assistant Pydantic Models — TrustShare AI Assistant

Request/response schemas for admin config API and public chat API.
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field

# ADMIN CONFIG SCHEMAS


class ConfigItemOut(BaseModel):
    key: str
    value: Optional[Any] = None
    display_value: str
    type: str
    description: Optional[str] = None
    is_secret: bool
    is_editable: bool
    is_configured: bool
    category: str
    display_order: int


class ConfigCategoryOut(BaseModel):
    category: str
    items: list[ConfigItemOut]


class UpdateConfigRequest(BaseModel):
    value: Any = Field(description="New value (string/int/bool/None)")


class BulkUpdateConfigsRequest(BaseModel):
    updates: dict[str, Any] = Field(description="Map of {config_key: new_value}")


class ConfigUpdateResult(BaseModel):
    status: str
    message: str
    updated_key: Optional[str] = None
    updated_count: int = 0


# CONNECTION TEST SCHEMAS


class TestConnectionRequest(BaseModel):
    """Admin tests LLM connection. Uses saved config unless overridden."""

    api_key: Optional[str] = Field(
        default=None,
        description="Optional: test with this key without saving. If omitted, uses saved key.",
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional: test with this model. If omitted, uses saved model.",
    )


class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    model_used: Optional[str] = None
    response_time_ms: Optional[int] = None
    error_type: Optional[str] = None


# PUBLIC / USER-FACING SCHEMAS


class AssistantStatusOut(BaseModel):
    is_enabled: bool
    is_configured: bool
    bot_name: str
    bot_tagline: str
    bot_avatar_icon: str
    show_suggested_queries: bool
    show_bubble: bool
    max_message_length: int
    message: Optional[str] = None
    data_queries_available: bool = False


class SuggestedQueryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    query_text: str
    category: str
    icon_name: Optional[str] = None
    display_order: int
    intent_id: Optional[str] = None


# CHAT SCHEMAS


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=5000)
    conversation_id: Optional[int] = None
    intent_id: Optional[str] = Field(default=None, max_length=64)
    suggestion_id: Optional[int] = Field(default=None, ge=1)
    request_id: Optional[str] = Field(default=None, min_length=16, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$")


class FunctionCallOut(BaseModel):
    name: str
    args: dict = Field(default_factory=dict)
    result: Any = None


class ChatResponse(BaseModel):
    conversation_id: Optional[int] = None
    message: str
    function_calls: list[FunctionCallOut] = []
    is_new_conversation: bool = False
    tokens_used: Optional[int] = None
    model_used: Optional[str] = None
    error: bool = False
    request_id: Optional[str] = None
    route: Optional[str] = None
    performance: Optional[dict] = None


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: Optional[str] = None
    message_count: int
    is_archived: bool
    created_at: str
    updated_at: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: Optional[str] = None
    function_name: Optional[str] = None
    function_result: Optional[Any] = None
    tokens_used: Optional[int] = None
    model_used: Optional[str] = None
    created_at: str
