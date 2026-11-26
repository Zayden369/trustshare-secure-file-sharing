from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from src.database.core import Base


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    permission = Column(String, default="view")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    password_hash = Column(String, nullable=True)
    max_views = Column(Integer, nullable=True)
    access_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)

class ShareLinkArchive(Base):
    """Owner-hidden links retain their original row and all audit references."""
    __tablename__ = "share_link_archives"
    share_id = Column(Integer, ForeignKey("share_links.id"), primary_key=True)
    archived_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
