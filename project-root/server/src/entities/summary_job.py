"""Additive job leases and previous completed results; no plaintext source cache."""
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from src.database.core import Base


class SummaryJob(Base):
    __tablename__ = 'summary_jobs'
    summary_id = Column(Integer, ForeignKey('file_summaries.id',ondelete='CASCADE'), primary_key=True)
    generation_id = Column(String(32), nullable=False)
    policy = Column(String(64), nullable=False)
    phase = Column(String(32), nullable=False, default='queued')
    metrics = Column(JSON, nullable=True)
    request_metrics = Column(JSON, nullable=True)
    provider_retry_at = Column(DateTime(timezone=True), nullable=True)
    queued_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class SummaryRevision(Base):
    __tablename__ = 'summary_revisions'
    generation_id = Column(String(32), primary_key=True)
    summary_id = Column(Integer, ForeignKey('file_summaries.id',ondelete='CASCADE'), nullable=False, index=True)
    policy = Column(String(64), nullable=True)
    result = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
