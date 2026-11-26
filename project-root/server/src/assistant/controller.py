"""
Assistant Public Controller — TrustShare AI Assistant

User-facing endpoints available to all authenticated users.
"""

import logging
import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user, oauth2_scheme
from src.database.core import get_db, SessionLocal
from src.entities.user import User
from src.entities.assistant_suggested_query import AssistantSuggestedQuery

from src.assistant import config_service, conversation_service, chat_service
from src.assistant.models import (
    AssistantStatusOut,
    ChatRequest,
    ChatResponse,
    ConversationOut,
    MessageOut,
    SuggestedQueryOut,
)
from src.security.rate_limiter import check_rate_limit
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/status", response_model=AssistantStatusOut)
def get_assistant_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current assistant status and UI config."""
    is_enabled = config_service.get_bool(db, "ENABLE_ASSISTANT", False)
    is_configured = config_service.is_assistant_configured(db)

    message = None
    if not is_enabled:
        message = "AI Assistant is currently disabled."
    elif not is_configured:
        if current_user.role == "admin":
            message = "AI Assistant needs to be configured. Please set the API key in the admin panel."
        else:
            message = (
                "AI Assistant is not configured yet. Please contact your administrator."
            )

    return AssistantStatusOut(
        is_enabled=is_enabled,
        is_configured=is_configured,
        bot_name=config_service.get_str(db, "BOT_NAME", "TrustShare Assistant"),
        bot_tagline=config_service.get_str(
            db, "BOT_TAGLINE", "AI-powered file assistant"
        ),
        bot_avatar_icon=config_service.get_str(db, "BOT_AVATAR_ICON", "Sparkles"),
        show_suggested_queries=config_service.get_bool(
            db, "SHOW_SUGGESTED_QUERIES", True
        ),
        show_bubble=config_service.get_bool(db, "ENABLE_BUBBLE", True),
        max_message_length=config_service.get_int(db, "MAX_MESSAGE_LENGTH", 2000),
        message=message,
        data_queries_available=is_enabled,
    )


@router.get("/suggestions", response_model=list[SuggestedQueryOut])
def get_suggested_queries(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Get all active suggested queries for the chat UI."""
    rows = (
        db.query(AssistantSuggestedQuery)
        .filter(AssistantSuggestedQuery.is_active == True)
        .order_by(
            AssistantSuggestedQuery.category,
            AssistantSuggestedQuery.display_order,
        )
        .all()
    )
    from src.assistant.intents import BY_TEXT, normalize
    return [SuggestedQueryOut.model_validate(row).model_copy(update={
        'intent_id': BY_TEXT[normalize(row.query_text)].id if normalize(row.query_text) in BY_TEXT else None,
    }) for row in rows]


# CHAT ENDPOINT


@router.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a chat message and get an AI-generated response.

    LLM may call one or more functions to answer the query
    (e.g., list_files, get_storage_info).
    """
    # Rate limit check
    client_id = str(current_user.id)
    rl = check_rate_limit(client_id, "assistant_chat", db)
    if not rl.get("allowed"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Rate limit exceeded. Please wait before sending more messages.",
                "reset_in": rl.get("reset_in"),
                "limit": rl.get("limit"),
            },
        )

    result = chat_service.process_chat(
        db=db,
        user=current_user,
        user_message=body.message,
        conversation_id=body.conversation_id,
        intent_id=body.intent_id,
        suggestion_id=body.suggestion_id,
        request_id=body.request_id,
    )

    return ChatResponse(
        conversation_id=result.get("conversation_id"),
        message=result.get("message", ""),
        function_calls=result.get("function_calls") or [],
        is_new_conversation=result.get("is_new_conversation", False),
        tokens_used=result.get("tokens_used"),
        model_used=result.get("model_used"),
        error=result.get("error", False),
        request_id=result.get('request_id'),
        route=result.get('route'),
        performance=result.get('performance'),
    )


@router.post('/chat/stream')
def stream_chat(body: ChatRequest, request: Request, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user), token: str = Depends(oauth2_scheme)):
    # Validate before response headers and retain the JSON endpoint's rate limit.
    from src.assistant.intents import resolve
    resolve(db,body.message,body.intent_id,body.suggestion_id)
    if not config_service.get_bool(db,'ENABLE_ASSISTANT',False):
        raise HTTPException(503,'AI Assistant is currently disabled.')
    if len(body.message) > config_service.get_int(db,'MAX_MESSAGE_LENGTH',2000):
        raise HTTPException(400,'Message exceeds the configured maximum.')
    rl = check_rate_limit(str(current_user.id),'assistant_chat',db)
    if not rl.get('allowed'):
        raise HTTPException(429,{'message':'Rate limit exceeded. Please wait before sending more messages.', 'reset_in':rl.get('reset_in')})
    user_id = current_user.id

    def guard():
        # Separate sessions also observe logout/revocation during a long stream.
        with SessionLocal() as auth_db:
            actor = get_current_user(token=token,db=auth_db)
            if actor.id != user_id:
                raise HTTPException(401,'Session changed. Please sign in again.')

    async def events():
        # FastAPI 0.110 releases dependency sessions before streaming finishes.
        # This generator owns its session for the complete response lifetime.
        with SessionLocal() as stream_db:
            user = stream_db.get(User,user_id)
            engine = chat_service.chat_events(stream_db,user,body.message,body.conversation_id,
                body.intent_id,body.suggestion_id,body.request_id,guard=guard)
            try:
                async for event in engine:
                    yield 'event: '+event['event']+'\ndata: '+json.dumps(event['data'],ensure_ascii=False,default=str)+'\n\n'
            finally:
                await engine.aclose()

    return StreamingResponse(events(),media_type='text/event-stream',headers={
        'Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no',
    })


# CONVERSATION HISTORY


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List user's non-archived conversations."""
    convs = conversation_service.list_conversations(db, current_user.id)
    return [
        ConversationOut(
            id=c.id,
            title=c.title,
            message_count=c.message_count or 0,
            is_archived=bool(c.is_archived),
            created_at=c.created_at.isoformat() if c.created_at else "",
            updated_at=c.updated_at.isoformat() if c.updated_at else "",
        )
        for c in convs
    ]


@router.get(
    "/conversations/{conversation_id}/messages", response_model=list[MessageOut]
)
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all messages in a conversation."""
    conv = conversation_service.get_conversation(db, conversation_id, current_user.id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    messages = conversation_service.get_messages(db, conversation_id)
    return [
        MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            function_name=m.function_name,
            function_result=m.function_result,
            tokens_used=m.tokens_used,
            model_used=m.model_used,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )
        for m in messages
    ]


@router.delete(
    "/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT
)
def archive_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Archive (soft-delete) a conversation."""
    ok = conversation_service.archive_conversation(db, conversation_id, current_user.id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )
    return None


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
def rename_conversation(
    conversation_id: int,
    body: RenameConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = conversation_service.get_conversation(db, conversation_id, current_user.id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found.",
        )

    conv.title = body.title.strip()[:200]
    db.commit()
    db.refresh(conv)

    return ConversationOut(
        id=conv.id,
        title=conv.title,
        message_count=conv.message_count or 0,
        is_archived=bool(conv.is_archived),
        created_at=conv.created_at.isoformat() if conv.created_at else "",
        updated_at=conv.updated_at.isoformat() if conv.updated_at else "",
    )
