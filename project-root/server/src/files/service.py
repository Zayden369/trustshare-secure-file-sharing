# server/src/files/service.py

import re
import uuid
import hashlib
import mimetypes
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from fastapi import HTTPException, UploadFile, status

from src.entities.file import File
from src.entities.folder import Folder
from src.entities.user import User
from src.entities.audit_log import AuditLog
from src.entities.file_version import FileVersion
from src.security.exceptions import KeyManagementError

from src.security.validation.validators import validate_upload
from src.security.key_manager import (
    generate_key,
    save_key,
    load_key,
    delete_key,
)
from src.security.encryption import encrypt_bytes, decrypt_bytes
from src.security.secure_storage import (
    save_encrypted_file,
    load_encrypted_file,
    delete_encrypted_file,
)
from src.notifications.service import create_notification
from src.analytics.services import log_event
from src.analytics.constants import (
    AnalyticsEventType,
    AnalyticsEventStatus,
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def sanitize_filename(filename: str) -> str:
    filename = Path(filename).name
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", filename)
    filename = filename.strip()
    if not filename:
        filename = "uploaded_file"
    return filename


DANGEROUS_SIGNATURES = [
    b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR",
    b"MZ\x90\x00",
    b"\x7fELF",
    b"#!/",
]

DANGEROUS_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs",
    ".jar", ".msi", ".dll", ".com", ".scr",
}


def _basic_malware_check(filename: str, file_bytes: bytes) -> None:
    ext = Path(filename).suffix.lower()
    if ext in DANGEROUS_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} is not permitted for security reasons.",
        )

    for signature in DANGEROUS_SIGNATURES:
        if file_bytes.startswith(signature):
            raise HTTPException(
                status_code=400,
                detail="File content is not permitted for security reasons.",
            )


def _audit(
    db: Session,
    user_id: int,
    action: str,
    resource_name: str,
    resource_id: int = None,
    level: str = "info",
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type="file",
        resource_id=resource_id,
        resource_name=resource_name,
        level=level,
    )
    db.add(log)


def _detect_suspicious_activity(
    db: Session,
    user_id: int,
    ip_address: str | None = None,
):
    failed_attempts = (
        db.query(AuditLog)
        .filter(
            AuditLog.user_id == user_id,
            AuditLog.action.in_([
                "UNAUTHORIZED_ACCESS",
                "UNAUTHORIZED_DOWNLOAD",
            ]),
        )
        .count()
    )

    if failed_attempts >= 5:
        _audit(
            db,
            user_id,
            "SUSPICIOUS_ACTIVITY",
            "Repeated unauthorized access attempts",
            level="critical",
        )

        log_event(
            db,
            event_type=AnalyticsEventType.SECURITY,
            user_id=user_id,
            status=AnalyticsEventStatus.FAILED,
            ip_address=ip_address,
            event_metadata={
                "severity_key": "brute_force",
                "label": "Suspicious file access detected",
                "detail": f"{failed_attempts} unauthorized file access attempts",
                "target": f"user_{user_id}",
                "attempts": failed_attempts,
            },
        )


# ═══════════════════════════════════════════════════════════════════════════
# LIST FILES
# ═══════════════════════════════════════════════════════════════════════════

def get_user_files(
    db: Session,
    owner_id: int,
    folder_id: int | None = None,
) -> list[File]:
    q = db.query(File).filter(
        File.owner_id == owner_id,
        File.is_deleted == False,
    )
    if folder_id is not None:
        q = q.filter(File.folder_id == folder_id)
    else:
        q = q.filter(File.folder_id == None)
    return q.order_by(File.created_at.desc()).all()


# ═══════════════════════════════════════════════════════════════════════════
# GET FILE (with ownership check)
# ═══════════════════════════════════════════════════════════════════════════

def get_file(
    db: Session,
    file_id: int,
    owner_id: int,
    ip_address: str | None = None,
) -> File:
    file = db.query(File).filter(File.id == file_id, File.is_deleted == False).first()

    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File not found"
        )

    if file.owner_id != owner_id:
        _audit(
            db,
            owner_id,
            "UNAUTHORIZED_ACCESS",
            file.original_name,
            resource_id=file.id,
            level="warning",
        )
        _detect_suspicious_activity(db, owner_id, ip_address=ip_address)

        log_event(
            db,
            event_type=AnalyticsEventType.SECURITY,
            user_id=owner_id,
            file_id=file.id,
            status=AnalyticsEventStatus.FAILED,
            ip_address=ip_address,
            event_metadata={
                "severity_key": "unusual_access",
                "label": "Unauthorized file access",
                "detail": f"User attempted to access file {file.original_name}",
                "target": file.original_name,
                "attempts": 1,
            },
        )

        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this file.",
        )

    return file


# ═══════════════════════════════════════════════════════════════════════════
# UPLOAD
# ═══════════════════════════════════════════════════════════════════════════

def upload_file(
    db: Session,
    upload: UploadFile,
    owner_id: int,
    folder_id: int | None,
    encrypted: bool,
    ip_address: str | None = None,
) -> File:
    upload.file.seek(0)
    file_bytes = upload.file.read()
    file_size = len(file_bytes)
    upload.file.seek(0)

    try:
        _basic_malware_check(upload.filename, file_bytes)
    except HTTPException:
        raise

    try:
        validate_upload(db, upload, file_size)
    except HTTPException as e:
        log_event(
            db,
            event_type=AnalyticsEventType.UPLOAD,
            user_id=owner_id,
            status=AnalyticsEventStatus.FAILED,
            ip_address=ip_address,
            event_metadata={
                "severity_key": "unusual_access",
                "label": "File upload rejected",
                "detail": e.detail if hasattr(e, "detail") else "Validation failed",
                "target": upload.filename,
                "attempts": 1,
            },
        )
        db.commit()
        raise

    safe_filename = sanitize_filename(upload.filename)
    stored_name = f"{uuid.uuid4().hex}{Path(safe_filename).suffix.lower()}"

    if encrypted:
        aes_key = generate_key()
        save_key(stored_name, aes_key)
        stored_bytes = encrypt_bytes(file_bytes, aes_key)
    else:
        stored_bytes = file_bytes

    save_encrypted_file(stored_name, stored_bytes)
    hash_sha256 = hashlib.sha256(file_bytes).hexdigest()

    mimetype = (
        upload.content_type
        or mimetypes.guess_type(safe_filename)[0]
        or "application/octet-stream"
    )

    file = File(
        original_name=safe_filename,
        stored_name=stored_name,
        mimetype=mimetype,
        size=file_size,
        encrypted=encrypted,
        hash_sha256=hash_sha256,
        owner_id=owner_id,
        folder_id=folder_id,
        version=1,
    )

    db.add(file)
    db.flush()

    user = db.query(User).filter(User.id == owner_id).first()
    if user:
        user.storage_used = (user.storage_used or 0) + file_size

    _audit(
        db,
        owner_id,
        "UPLOAD",
        safe_filename,
        resource_id=file.id,
        level="info",
    )

    log_event(
        db,
        event_type=AnalyticsEventType.UPLOAD,
        user_id=owner_id,
        file_id=file.id,
        status=AnalyticsEventStatus.SUCCESS,
        ip_address=ip_address,
        event_metadata={
            "target": safe_filename,
            "size_bytes": file_size,
            "mimetype": mimetype,
            "encrypted": encrypted,
        },
    )

    db.commit()
    db.refresh(file)

    try:
        from src.search.service import get_or_index_file_content
        get_or_index_file_content(db, file)
    except Exception:
        pass

    return file


def move_file(
    db: Session,
    file_id: int,
    owner_id: int,
    folder_id: int | None,
) -> File:
    file = (
        db.query(File)
        .filter(
            File.id == file_id,
            File.owner_id == owner_id,
            File.is_deleted == False,
        )
        .first()
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if folder_id is not None:
        folder = (
            db.query(Folder)
            .filter(Folder.id == folder_id, Folder.owner_id == owner_id)
            .first()
        )
        if not folder:
            raise HTTPException(status_code=404, detail="Target folder not found")

    file.folder_id = folder_id
    db.commit()
    db.refresh(file)
    return file


# ═══════════════════════════════════════════════════════════════════════════
# DELETE
# ═══════════════════════════════════════════════════════════════════════════

def delete_file(
    db: Session,
    file_id: int,
    owner_id: int,
    ip_address: str | None = None,
) -> None:
    file = get_file(db, file_id, owner_id, ip_address=ip_address)

    if file.owner_id != owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )

    try:
        delete_encrypted_file(file.stored_name)
    except Exception:
        pass

    if file.encrypted:
        try:
            delete_key(file.stored_name)
        except Exception:
            pass

    try:
        from src.entities.file_content import FileContent
        db.query(FileContent).filter(FileContent.file_id == file.id).delete(
            synchronize_session=False
        )
    except Exception:
        pass

    try:
        from src.entities.file_summary import FileSummary
        db.query(FileSummary).filter(FileSummary.file_id == file.id).delete(
            synchronize_session=False
        )
    except Exception:
        pass

    try:
        from src.entities.file_permission import FilePermission
        db.query(FilePermission).filter(FilePermission.file_id == file.id).delete(
            synchronize_session=False
        )
    except Exception:
        pass

    try:
        from src.entities.share_link import ShareLink
        db.query(ShareLink).filter(ShareLink.file_id == file.id).update(
            {"is_active": False}, synchronize_session=False
        )
    except Exception:
        pass

    file.is_deleted = True

    user = db.query(User).filter(User.id == owner_id).first()
    if user:
        user.storage_used = max(0, user.storage_used - file.size)

    _audit(
        db,
        owner_id,
        "DELETE",
        file.original_name,
        resource_id=file.id,
        level="warn",
    )

    log_event(
        db,
        event_type=AnalyticsEventType.DELETE,
        user_id=owner_id,
        file_id=file.id,
        status=AnalyticsEventStatus.SUCCESS,
        ip_address=ip_address,
        event_metadata={
            "target": file.original_name,
            "size_bytes": file.size,
        },
    )

    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# GET FILE PATH (Decrypted Bytes)
# ═══════════════════════════════════════════════════════════════════════════

def get_file_path(
    db: Session,
    file_id: int,
    owner_id: int,
    ip_address: str | None = None,
    notification_user_id: int | None = None,
    record_download: bool = True,
) -> tuple[bytes, str, str]:
    file = db.query(File).filter(File.id == file_id, File.is_deleted == False).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.owner_id != owner_id:
        raise HTTPException(
            status_code=403, detail="You are not authorized to access this file."
        )

    try:
        encrypted_bytes = load_encrypted_file(file.stored_name)
    except Exception:
        raise HTTPException(status_code=500, detail="Encrypted file not found.")

    if file.encrypted:
        try:
            aes_key = load_key(file.stored_name)
        except Exception:
            raise HTTPException(status_code=500, detail="Encryption key not found.")

        try:
            decrypted_bytes = decrypt_bytes(encrypted_bytes, aes_key)
        except Exception:
            raise HTTPException(
                status_code=500, detail="Unable to decrypt file. Integrity compromised."
            )
    else:
        decrypted_bytes = encrypted_bytes

    # Record only explicit downloads. Preview/stream callers opt out so opening a
    # file cannot inflate the download metrics. Notifications remain delegated to
    # the relevant routers to avoid duplicate delivery.
    if record_download:
        file.download_count = (file.download_count or 0) + 1
        file.last_downloaded_at = datetime.now(timezone.utc)

        _audit(
            db,
            owner_id,
            "DOWNLOAD",
            file.original_name,
            resource_id=file.id,
            level="info",
        )
        log_event(
            db,
            event_type=AnalyticsEventType.DOWNLOAD,
            user_id=owner_id,
            file_id=file.id,
            status=AnalyticsEventStatus.SUCCESS,
            ip_address=ip_address,
            event_metadata={
                "target": file.original_name,
                "size_bytes": file.size,
                "downloaded_by_user_id": notification_user_id or owner_id,
            },
        )
        if notification_user_id is None:
            create_notification(
                db,
                user_id=owner_id,
                type="download",
                category="downloads",
                title="File downloaded",
                message=f'"{file.original_name}" was downloaded.',
                icon="download",
                resource_id=file.id,
                resource_type="file",
            )
        db.commit()

    return (
        decrypted_bytes,
        file.original_name,
        file.mimetype or "application/octet-stream",
    )


# ═══════════════════════════════════════════════════════════════════════════
# ROTATE ENCRYPTION KEY
# ═══════════════════════════════════════════════════════════════════════════

def rotate_file_key(
    db: Session,
    file_id: int,
    owner_id: int,
    ip_address: str | None = None,
) -> None:
    file = get_file(db, file_id, owner_id, ip_address=ip_address)

    encrypted_bytes = load_encrypted_file(file.stored_name)
    current_key = load_key(file.stored_name)
    decrypted_bytes = decrypt_bytes(encrypted_bytes, current_key)

    new_key = generate_key()
    new_encrypted_bytes = encrypt_bytes(decrypted_bytes, new_key)

    save_encrypted_file(file.stored_name, new_encrypted_bytes)

    try:
        save_key(file.stored_name, new_key)
    except Exception as e:
        try:
            save_encrypted_file(file.stored_name, encrypted_bytes)
        except Exception:
            _audit(
                db,
                owner_id,
                "KEY_ROTATION_FAILED_UNRECOVERABLE",
                file.original_name,
                resource_id=file.id,
                level="critical",
            )
            db.commit()
            raise KeyManagementError(
                f"Key rotation failed and rollback failed. File {file.id} may be corrupted: {e}"
            )

        _audit(
            db,
            owner_id,
            "KEY_ROTATION_FAILED",
            file.original_name,
            resource_id=file.id,
            level="error",
        )
        db.commit()
        raise KeyManagementError(
            f"Key rotation failed, rolled back to previous key: {e}"
        )

    _audit(
        db,
        owner_id,
        "KEY_ROTATION",
        file.original_name,
        resource_id=file.id,
        level="info",
    )
    db.commit()


# ═══════════════════════════════════════════════════════════════════════════
# FILE VERSION MANAGEMENT (PSD Module 2.v) — Immutable History
# ═══════════════════════════════════════════════════════════════════════════

def list_file_versions(db: Session, file_id: int, user_id: int) -> dict:
    file = get_file(db, file_id, user_id)
    history = (
        db.query(FileVersion)
        .filter(FileVersion.file_id == file_id)
        .order_by(FileVersion.version_number.desc())
        .all()
    )

    all_versions = []

    # 1. Current active version
    all_versions.append({
        "id": 0,
        "file_id": file.id,
        "version_number": file.version or 1,
        "size": file.size,
        "mimetype": file.mimetype,
        "hash_sha256": file.hash_sha256,
        "is_current": True,
        "created_at": file.updated_at or file.created_at,
        "created_by": file.owner_id,
    })

    # 2. Historical versions
    current_ver = file.version or 1
    for v in history:
        if v.version_number != current_ver:
            all_versions.append({
                "id": v.id,
                "file_id": v.file_id,
                "version_number": v.version_number,
                "size": v.size,
                "mimetype": v.mimetype,
                "hash_sha256": v.hash_sha256,
                "is_current": False,
                "created_at": v.created_at,
                "created_by": v.created_by,
            })

    all_versions.sort(key=lambda x: x["version_number"], reverse=True)

    return {
        "file_id": file.id,
        "file_name": file.original_name,
        "current_version": file.version or 1,
        "versions": all_versions,
    }


def upload_new_version(
    db: Session,
    file_id: int,
    upload: UploadFile,
    user_id: int,
    ip_address: str | None = None,
) -> File:
    file = get_file(db, file_id, user_id)

    upload.file.seek(0)
    file_bytes = upload.file.read()
    file_size = len(file_bytes)
    upload.file.seek(0)

    _basic_malware_check(upload.filename, file_bytes)
    validate_upload(db, upload, file_size)

    # 1. Archive current active version
    current_ver = file.version or 1
    archived_version = FileVersion(
        file_id=file.id,
        version_number=current_ver,
        stored_name=file.stored_name,
        mimetype=file.mimetype,
        size=file.size,
        encrypted=file.encrypted,
        hash_sha256=file.hash_sha256,
        created_at=file.updated_at or file.created_at,
        created_by=file.owner_id,
    )
    db.add(archived_version)

    # 2. Encrypt and store new version
    new_stored_name = f"{uuid.uuid4().hex}{Path(file.original_name).suffix.lower()}"
    new_key = generate_key()
    save_key(new_stored_name, new_key)
    stored_bytes = encrypt_bytes(file_bytes, new_key)
    save_encrypted_file(new_stored_name, stored_bytes)

    # 3. Update active file record
    old_size = file.size
    file.stored_name = new_stored_name
    file.size = file_size
    file.mimetype = upload.content_type or file.mimetype
    file.hash_sha256 = hashlib.sha256(file_bytes).hexdigest()
    file.version = current_ver + 1
    file.updated_at = datetime.now(timezone.utc)

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.storage_used = (user.storage_used or 0) + (file_size - old_size)

    _audit(
        db,
        user_id,
        "UPLOAD_VERSION",
        file.original_name,
        resource_id=file.id,
        level="info",
    )

    log_event(
        db,
        event_type=AnalyticsEventType.UPLOAD,
        user_id=user_id,
        file_id=file.id,
        status=AnalyticsEventStatus.SUCCESS,
        ip_address=ip_address,
        event_metadata={
            "target": file.original_name,
            "version": file.version,
            "size_bytes": file_size,
        },
    )

    db.commit()
    db.refresh(file)
    return file


def restore_file_version(
    db: Session,
    file_id: int,
    version_id: int,
    user_id: int,
    ip_address: str | None = None,
) -> File:
    file = get_file(db, file_id, user_id)

    target_version = (
        db.query(FileVersion)
        .filter(FileVersion.id == version_id, FileVersion.file_id == file_id)
        .first()
    )
    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found.")

    current_ver = file.version or 1

    # Archive current active version
    current_archived = FileVersion(
        file_id=file.id,
        version_number=current_ver,
        stored_name=file.stored_name,
        mimetype=file.mimetype,
        size=file.size,
        encrypted=file.encrypted,
        hash_sha256=file.hash_sha256,
        created_at=file.updated_at or file.created_at,
        created_by=file.owner_id,
    )
    db.add(current_archived)

    # Swap to restored version
    file.stored_name = target_version.stored_name
    file.size = target_version.size
    file.mimetype = target_version.mimetype
    file.hash_sha256 = target_version.hash_sha256
    file.version = current_ver + 1
    file.updated_at = datetime.now(timezone.utc)

    _audit(
        db,
        user_id,
        "RESTORE_VERSION",
        file.original_name,
        resource_id=file.id,
        level="info",
    )

    db.commit()
    db.refresh(file)
    return file


def download_historical_version(
    db: Session,
    file_id: int,
    version_id: int,
    user_id: int,
) -> tuple[bytes, str, str]:
    file = get_file(db, file_id, user_id)

    target_version = (
        db.query(FileVersion)
        .filter(FileVersion.id == version_id, FileVersion.file_id == file_id)
        .first()
    )
    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found.")

    encrypted_bytes = load_encrypted_file(target_version.stored_name)
    key = load_key(target_version.stored_name)
    decrypted_bytes = decrypt_bytes(encrypted_bytes, key)

    return (
        decrypted_bytes,
        f"v{target_version.version_number}_{file.original_name}",
        target_version.mimetype or "application/octet-stream",
    )
