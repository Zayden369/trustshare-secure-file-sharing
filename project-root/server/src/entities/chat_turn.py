"""Idempotent turns store message references, not another copy of account data."""
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON, Index, text
from sqlalchemy.sql import func
from src.database.core import Base


class ChatTurn(Base):
    __tablename__ = "assistant_chat_turns"
    __table_args__ = (
        Index("uq_assistant_running_conversation", "conversation_id", unique=True,
              sqlite_where=text("status = 'processing'"), postgresql_where=text("status = 'processing'")),
    )
    request_id = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False)
    request_checksum = Column(String(64), nullable=False)
    user_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    assistant_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    function_message_ids = Column(JSON, nullable=False, default=list)
    status = Column(String(20), nullable=False, default="processing")
    route = Column(String(40), nullable=True)
    metrics = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
