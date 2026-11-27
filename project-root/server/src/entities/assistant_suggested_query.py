"""
Assistant Suggested Query Entity — TrustShare AI Assistant

"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from src.database.core import Base


class AssistantSuggestedQuery(Base):
    __tablename__ = "assistant_suggested_queries"

    id = Column(Integer, primary_key=True, index=True)

    query_text = Column(
        String(300),
        nullable=False,
    )

    category = Column(
        String(50),
        nullable=False,
        index=True,
    )

    icon_name = Column(
        String(50),
        nullable=True,
    )

    display_order = Column(
        Integer,
        nullable=False,
        default=0,
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class AssistantSuggestionIntent(Base):
    """Optional admin-curated mappings for custom labels; operations stay in code."""
    __tablename__='assistant_suggestion_intents'
    suggestion_id=Column(Integer,ForeignKey('assistant_suggested_queries.id',ondelete='CASCADE'),primary_key=True)
    intent_id=Column(String(64),nullable=False)
