import hashlib
import os
import re
import time
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
    try:
        encrypted = load_encrypted_file(file.stored_name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="The stored document is missing. Upload the file again before generating a summary.") from exc
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
    provider = None
    try:
        provider = _provider()
        return provider.generate_summary(text, options), provider, None
    except ProviderUnavailable:
        if os.getenv("ENABLE_SUMMARY_FALLBACK", "true").lower() != "true" or (provider and provider.name == "extractive_fallback"):
            raise
        fallback = ExtractiveFallbackProvider()
        return fallback.generate_summary(fallback_text if fallback_text is not None else text, options), fallback, "Configured AI provider was unavailable; an extractive fallback was used."


def _source_for_model(text: str) -> tuple[str, str | None]:
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
    limit = min(9000, max(3000, _int_env("SUMMARY_MODEL_INPUT_CHARACTERS", 7000)))
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


def create_summary(db: Session, file_id: int, user_id: int, data: SummaryCreate) -> tuple[FileSummary, bool]:
    file = authorize_file(db, file_id, user_id)
    if data.file_version_id is not None:
        raise HTTPException(status_code=400, detail="File version identifiers are not available in this project.")
    max_bytes = _int_env("SUMMARY_MAX_FILE_SIZE_MB", 20) * 1024 * 1024
    if file.size > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds the {max_bytes // 1024 // 1024} MB summary limit.")
    checksum = file.hash_sha256 or f"metadata-{file.id}-{file.version}-{file.size}"
    query = db.query(FileSummary).filter(
        FileSummary.file_id == file.id, FileSummary.source_file_version == (file.version or 1),
        FileSummary.source_checksum == checksum, FileSummary.summary_length == data.summary_length,
        FileSummary.output_language == data.output_language, FileSummary.output_format == data.output_format,
    )
    existing = query.first()
    if existing and not data.force_regenerate:
        if existing.status in {"pending", "processing"}:
            raise HTTPException(status_code=409, detail="An identical summary is already being generated.")
        if existing.status == "completed":
            should_refresh_fallback = False
            if existing.provider == "extractive_fallback":
                try:
                    provider = _provider()
                    should_refresh_fallback = provider.name != "extractive_fallback" and provider.health_check()
                except ProviderUnavailable:
                    pass
            if not should_refresh_fallback:
                return existing, True
    if existing:
        existing.status, existing.error_message, existing.warning_message = "pending", None, None
        existing.requested_by_user_id = user_id
        summary = existing
    else:
        summary = FileSummary(
            file_id=file.id, source_file_version=file.version or 1,
            requested_by_user_id=user_id, status="pending", summary_length=data.summary_length,
            output_language=data.output_language, output_format=data.output_format, source_checksum=checksum,
        )
        db.add(summary)
    try:
        db.commit(); db.refresh(summary)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An identical summary request already exists.") from exc
    return summary, False


def process_summary(summary_id: int, variation: int = 0) -> None:
    db = SessionLocal()
    plaintext = None
    try:
        summary = db.query(FileSummary).filter(FileSummary.id == summary_id).first()
        if not summary: return
        summary.status = "processing"; db.commit()
        file = db.query(File).filter(File.id == summary.file_id, File.is_deleted == False).first()
        if not file: raise HTTPException(status_code=404, detail="File not found")
        started = time.perf_counter()
        plaintext = bytearray(_load_plaintext(file))
        text = extract_text(file.original_name, bytes(plaintext))
        max_chars = _int_env("SUMMARY_MAX_EXTRACTED_CHARACTERS", 120000)
        warning = None
        if len(text) > max_chars:
            text = text[:max_chars]
            warning = "Only part of the document was processed because the extracted-text limit was reached."
        options = {
            "summary_length": summary.summary_length,
            "output_language": summary.output_language,
            "output_format": summary.output_format,
            "variation": variation,
        }
        source, excerpt_warning = _source_for_model(text)
        result, used_provider, provider_warning = _run_provider(source, options, fallback_text=text)
        summary.title = result.get("title") or f"Summary of {file.original_name}"
        summary.summary_text = result["summary"]
        summary.key_points = result.get("key_points", [])
        summary.keywords = result.get("keywords", [])
        summary.provider, summary.model_name = used_provider.name, used_provider.model_name
        summary.extracted_character_count = len(text)
        summary.processing_time_ms = int((time.perf_counter() - started) * 1000)
        summary.warning_message = " ".join(filter(None, (warning, excerpt_warning if used_provider.name != "extractive_fallback" else None, provider_warning))) or None
        summary.status = "completed"
        summary.generated_at = datetime.now(timezone.utc)
        create_activity(db, ActivityCreate(user_id=summary.requested_by_user_id, action="AI_SUMMARY_GENERATED", file_name=file.original_name, description=f"Generated an AI summary for {file.original_name}"))
        db.add(Notification(user_id=summary.requested_by_user_id, type="summary", category="activity", title="File summary ready", message=f'Your summary for "{file.original_name}" is ready.', icon="sparkles"))
        db.commit()
    except Exception as exc:
        db.rollback()
        summary = db.query(FileSummary).filter(FileSummary.id == summary_id).first()
        if summary:
            summary.status = "failed"
            if isinstance(exc, HTTPException):
                detail = exc.detail
                summary.error_message = detail.get("message", "Summary generation failed.") if isinstance(detail, dict) else str(detail)
            elif isinstance(exc, ProviderUnavailable):
                summary.error_message = "The AI summary provider is unavailable."
            else:
                summary.error_message = "Summary generation failed safely."
            file = db.query(File).filter(File.id == summary.file_id).first()
            create_activity(db, ActivityCreate(user_id=summary.requested_by_user_id, action="AI_SUMMARY_FAILED", file_name=file.original_name if file else None, description="File summary generation failed"))
            db.commit()
    finally:
        if plaintext is not None:
            plaintext[:] = b"\x00" * len(plaintext)
        db.close()


def list_summaries(db: Session, file_id: int, user_id: int):
    authorize_file(db, file_id, user_id)
    return db.query(FileSummary).filter(FileSummary.file_id == file_id).order_by(FileSummary.created_at.desc()).all()


def get_summary(db: Session, file_id: int, summary_id: int, user_id: int) -> FileSummary:
    authorize_file(db, file_id, user_id)
    summary = db.query(FileSummary).filter(FileSummary.id == summary_id, FileSummary.file_id == file_id).first()
    if not summary: raise HTTPException(status_code=404, detail="Summary not found")
    return summary


def delete_summary(db: Session, file_id: int, summary_id: int, user_id: int):
    file = authorize_file(db, file_id, user_id)
    summary = get_summary(db, file_id, summary_id, user_id)
    if file.owner_id != user_id and summary.requested_by_user_id != user_id:
        raise HTTPException(status_code=403, detail="You cannot delete this summary.")
    if summary.status in {"pending", "processing"}:
        raise HTTPException(status_code=409, detail="A running summary cannot be deleted.")
    db.delete(summary); db.commit()
