"""
Conversation Service — TrustShare AI Assistant

Handles persistence of chat conversations and messages.
"""

import logging
from typing import Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from src.entities.chat_conversation import ChatConversation
from src.entities.chat_message import ChatMessage

logger = logging.getLogger(__name__)


def create_conversation(
    db: Session, user_id: int, title: Optional[str] = None
) -> ChatConversation:
    conv = ChatConversation(
        user_id=user_id,
        title=title,
        message_count=0,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def get_conversation(
    db: Session, conversation_id: int, user_id: int
) -> Optional[ChatConversation]:
    return (
        db.query(ChatConversation)
        .filter(
            ChatConversation.id == conversation_id,
            ChatConversation.user_id == user_id,
            ChatConversation.is_archived == False,
        )
        .first()
    )


def list_conversations(
    db: Session, user_id: int, include_archived: bool = False
) -> list[ChatConversation]:
    query = db.query(ChatConversation).filter(ChatConversation.user_id == user_id)
    if not include_archived:
        query = query.filter(ChatConversation.is_archived == False)
    return query.order_by(desc(ChatConversation.updated_at)).all()


def archive_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
    conv = get_conversation(db, conversation_id, user_id)
    if not conv:
        return False
    conv.is_archived = True
    db.commit()
    return True


def add_message(
    db: Session,
    conversation_id: int,
    role: str,
    content: Optional[str] = None,
    function_name: Optional[str] = None,
    function_result: Optional[dict] = None,
    tokens_used: Optional[int] = None,
    model_used: Optional[str] = None,
    commit: bool = True,
) -> ChatMessage:

    msg = ChatMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        function_name=function_name,
        function_result=function_result,
        tokens_used=tokens_used,
        model_used=model_used,
    )
    db.add(msg)

    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id)
        .first()
    )
    if conv:
        conv.message_count = (conv.message_count or 0) + 1

    if commit:
        db.commit()
        db.refresh(msg)
    else:
        db.flush()
    return msg


def get_messages(
    db: Session, conversation_id: int, limit: Optional[int] = None
) -> list[ChatMessage]:
    """Get all messages in a conversation in chronological order."""
    query = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
    )
    if limit:
        msgs = query.order_by(desc(ChatMessage.id)).limit(limit).all()
        return list(reversed(msgs))
    return query.order_by(ChatMessage.id).all()


def messages_to_llm_format(messages: list[ChatMessage]) -> list[dict]:
    """
    Convert DB message rows to OpenAI/Groq message format.
    Filters out function messages that don't have results and cleans up.
    """
    result = []
    for m in messages:
        if m.role == "user":
            result.append({"role": "user", "content": m.content or ""})
        elif m.role == "assistant":
            if m.content:
                result.append({"role": "assistant", "content": m.content})
        elif m.role == "system":
            result.append({"role": "system", "content": m.content or ""})
    return result


def set_title_if_empty(db: Session, conversation_id: int, title: str) -> None:
    conv = (
        db.query(ChatConversation)
        .filter(ChatConversation.id == conversation_id)
        .first()
    )
    if conv and not conv.title:
        conv.title = title[:200]
        db.commit()
