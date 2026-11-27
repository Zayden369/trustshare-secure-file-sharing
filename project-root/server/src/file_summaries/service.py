import hashlib
import os
import re
import time
from contextlib import nullcontext
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.activity.models import ActivityCreate
from src.activity.service import create_activity
from src.database.core import SessionLocal
from src.entities.file import File
from src.entities.file_permission import FilePermission
from src.entities.file_summary import FileSummary
from src.entities.notification import Notification
from src.security.encryption import decrypt_bytes
from src.security.key_manager import load_key
from src.security.secure_storage import load_encrypted_file
from src.file_summaries.models import SummaryCreate
from src.file_summaries.providers import (
    ExtractiveFallbackProvider, HuggingFaceProvider, MockSummaryProvider,
    OllamaProvider, ProviderUnavailable,
)
from src.file_summaries.text_extraction import extract_text

READ_PERMISSIONS = {"view", "download", "edit", "admin"}


def _int_env(name: str, default: int) -> int:
    try: return int(os.getenv(name, str(default)))
    except ValueError: return default


def authorize_file(db: Session, file_id: int, user_id: int) -> File:
    file = db.query(File).filter(File.id == file_id, File.is_deleted == False).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    if file.owner_id == user_id:
        return file
    permission = db.query(FilePermission).filter(
        FilePermission.file_id == file_id,
        FilePermission.user_id == user_id,
        FilePermission.permission_level.in_(READ_PERMISSIONS),
    ).first()
    if not permission:
        raise HTTPException(status_code=403, detail="You do not have permission to summarise this file.")
    return file


def _load_plaintext(file: File) -> bytes:
    from src.ai_metrics import current_trace
    trace=current_trace.get()
    try:
        with trace.stage('file_retrieval') if trace else nullcontext():
            encrypted = load_encrypted_file(file.stored_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="The stored document is missing. Upload the file again before generating a summary.") from exc
    with trace.stage('decryption') if trace else nullcontext():
        data = decrypt_bytes(encrypted, load_key(file.stored_name)) if file.encrypted else encrypted
    checksum = hashlib.sha256(data).hexdigest()
    if file.hash_sha256 and checksum != file.hash_sha256:
        raise HTTPException(status_code=500, detail="File integrity verification failed.")
    return data


def _provider():
    name = os.getenv("AI_SUMMARY_PROVIDER", "ollama").strip().lower()
    timeout = _int_env("SUMMARY_REQUEST_TIMEOUT_SECONDS", 90)
    if name == "mock":
        if os.getenv("ENVIRONMENT", "development").lower() not in {"test", "testing"}:
            raise ProviderUnavailable("Mock summaries are available only in tests")
        return MockSummaryProvider()
    if name == "huggingface":
        if os.getenv("ALLOW_EXTERNAL_AI", "false").lower() != "true":
            raise ProviderUnavailable("External AI is disabled")
        return HuggingFaceProvider(os.getenv("HF_API_TOKEN", ""), os.getenv("HF_SUMMARY_MODEL", ""), timeout)
    if name == "extractive_fallback":
        return ExtractiveFallbackProvider()
    if name != "ollama":
        raise ProviderUnavailable("Unknown summary provider")
    return OllamaProvider(os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"), os.getenv("SUMMARY_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b"), timeout)


def _run_provider(text: str, options: dict, fallback_text: str | None = None):
    from src.ai_metrics import current_trace
    from src.ai_scheduler import inference_gate
    trace=current_trace.get()
    provider = None
    try:
        provider = _provider()
        gate=inference_gate.slot(timeout=30) if provider.name not in {'mock','extractive_fallback'} else nullcontext()
        with gate:
            if trace and getattr(trace,'on_inference_start',None):
                trace.on_inference_start()
            return provider.generate_summary(text, options), provider, None
    except ProviderUnavailable:
        if os.getenv("ENABLE_SUMMARY_FALLBACK", "true").lower() != "true" or (provider and provider.name == "extractive_fallback"):
            raise
        fallback = ExtractiveFallbackProvider()
        with trace.stage('extractive_fallback') if trace else nullcontext():
            result=fallback.generate_summary(fallback_text if fallback_text is not None else text, options)
        return result, fallback, "Configured AI provider was unavailable or its output failed validation; an extractive fallback was used."


def _source_for_model(text: str, character_limit=None) -> tuple[str, str | None]:
    """Bound CPU inference to one request while covering the document's span."""
    # Repeated headers or paragraphs consume CPU without adding facts. Keep
    # short fragments and the first occurrence of each complete long segment.
    segments = re.split(r"(?<=[.!?])\s+|\n+", text)
    seen, unique = set(), []
    removed = False
    for segment in segments:
        key = re.sub(r"\s+", " ", segment).strip()
        if len(key) >= 30 and key in seen:
            removed = True
            continue
        seen.add(key)
        unique.append(segment)
    if removed:
        text = "\n".join(unique)
    limit = (max(3000,character_limit) if character_limit is not None else
             min(9000, max(3000, _int_env("SUMMARY_MODEL_INPUT_CHARACTERS", 7000))))
    if len(text) <= limit:
        return text, None
    first = int(limit * 0.36)
    middle = int(limit * 0.34)
    last = limit - first - middle
    midpoint = len(text) // 2
    excerpt = "\n[Middle excerpt]\n".join((
        text[:first].rstrip(),
        text[midpoint - middle // 2:midpoint + (middle - middle // 2)].strip(),
    )) + "\n[Final excerpt]\n" + text[-last:].lstrip()
    return excerpt, "The summary uses excerpts from the start, middle, and end of this long document."


def create_summary(db: Session, file_id: int, user_id: int, data: SummaryCreate):
    from src.file_summaries.jobs import create_summary as create_job
    return create_job(db,file_id,user_id,data)


def process_summary(summary_id: int, variation: int = 0, queue_started=None):
    from src.file_summaries.jobs import process_summary as process_job
    return process_job(summary_id,variation,queue_started)


def list_summaries(db: Session, file_id: int, user_id: int):
    authorize_file(db, file_id, user_id)
    from src.file_summaries.jobs import decorate
    return [decorate(db,item) for item in db.query(FileSummary).filter(FileSummary.file_id == file_id).order_by(FileSummary.created_at.desc()).all()]


def get_summary(db: Session, file_id: int, summary_id: int, user_id: int) -> FileSummary:
    authorize_file(db, file_id, user_id)
    summary = db.query(FileSummary).filter(FileSummary.id == summary_id, FileSummary.file_id == file_id).first()
    if not summary: raise HTTPException(status_code=404, detail="Summary not found")
    from src.file_summaries.jobs import decorate
    return decorate(db,summary)


def delete_summary(db: Session, file_id: int, summary_id: int, user_id: int):
    file = authorize_file(db, file_id, user_id)
    summary = get_summary(db, file_id, summary_id, user_id)
    if file.owner_id != user_id and summary.requested_by_user_id != user_id:
        raise HTTPException(status_code=403, detail="You cannot delete this summary.")
    if summary.status in {"pending", "processing"}:
        raise HTTPException(status_code=409, detail="A running summary cannot be deleted.")
    from src.entities.summary_job import SummaryJob, SummaryRevision
    db.query(SummaryRevision).filter_by(summary_id=summary.id).delete(synchronize_session=False)
    db.query(SummaryJob).filter_by(summary_id=summary.id).delete(synchronize_session=False)
    db.delete(summary); db.commit()
