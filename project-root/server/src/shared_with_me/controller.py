# server/src/shared_with_me/controller.py

from datetime import datetime, timezone
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.auth.dependencies import get_current_user
from src.database.core import get_db
from src.entities.user import User
from src.entities.file import File
from src.entities.file_permission import FilePermission
from src.files.service import get_file_path
from src.notifications.service import create_notification
from src.shared_with_me import models
from src.shared_with_me.service import (
    get_downloadable_shared_file,
    grant_direct_share,
    list_direct_shares,
    list_shared_files,
    revoke_direct_share,
    update_direct_share_permission,
)

router = APIRouter()

# ── Independent dedup tracking structures ──────────────────────
_view_timestamps: dict[tuple[int, int], datetime] = {}
_download_timestamps: dict[tuple[int, int], datetime] = {}
_DEDUP_SECONDS = 3.0


def _should_record_view(user_id: int, file_id: int) -> bool:
    """Return True if this preview is outside the view dedup window."""
    key = (user_id, file_id)
    now = datetime.now(timezone.utc)
    last = _view_timestamps.get(key)
    if last and (now - last).total_seconds() <= _DEDUP_SECONDS:
        return False
    _view_timestamps[key] = now
    return True


def _should_record_download(user_id: int, file_id: int) -> bool:
    """Return True if this download is outside the download dedup window."""
    key = (user_id, file_id)
    now = datetime.now(timezone.utc)
    last = _download_timestamps.get(key)
    if last and (now - last).total_seconds() <= _DEDUP_SECONDS:
        return False
    _download_timestamps[key] = now
    return True


@router.get("/direct", response_model=models.DirectSharesResponse)
def direct_shares(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_direct_shares(db, current_user.id)


@router.post("/direct", response_model=models.DirectShareOut, status_code=status.HTTP_201_CREATED)
def create_direct_share(
    data: models.DirectShareCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return grant_direct_share(db, data, current_user.id)


@router.patch("/direct/{permission_id}", response_model=models.DirectShareOut)
def update_direct_share(
    permission_id: int,
    data: models.DirectShareUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_direct_share_permission(db, permission_id, data.permission, current_user.id)


@router.delete("/direct/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_direct_share(
    permission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    revoke_direct_share(db, permission_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/", response_model=models.SharedFilesResponse)
def shared_with_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_shared_files(db, current_user.id)


@router.get("/{file_id}/download")
def download_shared_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file, permission = get_downloadable_shared_file(db, file_id, current_user.id)

    if _should_record_download(current_user.id, file_id):
        permission.access_count = (permission.access_count or 0) + 1
        permission.last_accessed_at = datetime.now(timezone.utc)
        db.commit()

        create_notification(
            db,
            user_id=file.owner_id,
            type="download",
            category="downloads",
            title="Shared file downloaded",
            message=f'{current_user.name} downloaded your shared file "{file.original_name}".',
            icon="download",
            resource_id=file.id,
            resource_type="file",
            commit=True,
        )

    decrypted_bytes, original_name, mimetype = get_file_path(
        db,
        file.id,
        file.owner_id,
        notification_user_id=current_user.id,
    )

    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=mimetype or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{original_name}"',
            "Content-Length": str(len(decrypted_bytes)),
        },
    )


@router.get("/{file_id}/view")
def view_shared_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(FilePermission, File)
        .join(File, FilePermission.file_id == File.id)
        .filter(
            FilePermission.file_id == file_id,
            FilePermission.user_id == current_user.id,
            File.is_deleted == False,
            File.owner_id != current_user.id,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this file.",
        )

    permission, file = row

    if _should_record_view(current_user.id, file_id):
        permission.access_count = (permission.access_count or 0) + 1
        permission.last_accessed_at = datetime.now(timezone.utc)
        db.commit()

        create_notification(
            db,
            user_id=file.owner_id,
            type="access",
            category="downloads",
            title="Shared file viewed",
            message=f'{current_user.name} viewed your shared file "{file.original_name}".',
            icon="eye",
            resource_id=file.id,
            resource_type="file",
            commit=True,
        )

    decrypted_bytes, original_name, mimetype = get_file_path(
        db,
        file.id,
        file.owner_id,
        notification_user_id=current_user.id,
        record_download=False,
    )

    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=mimetype or file.mimetype or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{original_name}"',
            "Content-Length": str(len(decrypted_bytes)),
        },
    )
