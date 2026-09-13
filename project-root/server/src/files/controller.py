# server/src/files/controller.py

from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File as FastAPIFile,
    Query,
    HTTPException,
    Request,
)
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy.orm import Session
from typing import Optional
from src.database.core import get_db
from src.auth.dependencies import get_current_user, get_current_user_from_query
from src.entities.user import User
from src.files import models, service

router = APIRouter()


def _get_client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.get("/", response_model=models.FileListResponse)
def list_files(
    folder_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    files = service.get_user_files(db, current_user.id, folder_id)
    return {"files": files, "total": len(files)}


@router.post("/upload", response_model=models.FileOut, status_code=201)
def upload_file(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    folder_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)

    if current_user.storage_used >= current_user.storage_quota:
        from src.analytics.services import log_event
        from src.analytics.constants import (
            AnalyticsEventType,
            AnalyticsEventStatus,
        )

        log_event(
            db,
            event_type=AnalyticsEventType.UPLOAD,
            user_id=current_user.id,
            status=AnalyticsEventStatus.FAILED,
            ip_address=ip,
            event_metadata={
                "severity_key": "unusual_access",
                "label": "Upload rejected — quota exceeded",
                "detail": f"User {current_user.email} exceeded storage quota",
                "target": file.filename,
                "attempts": 1,
            },
        )
        db.commit()
        raise HTTPException(status_code=400, detail="Storage quota exceeded")

    return service.upload_file(
        db,
        file,
        current_user.id,
        folder_id,
        True,
        ip_address=ip,
    )


@router.patch("/{file_id}/move", response_model=models.FileOut)
def move_file(
    file_id: int,
    data: models.FileMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.move_file(db, file_id, current_user.id, data.folder_id)


@router.get("/{file_id}", response_model=models.FileOut)
def get_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    return service.get_file(db, file_id, current_user.id, ip_address=ip)


@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)

    decrypted_bytes, original_name, mimetype = service.get_file_path(
        db,
        file_id,
        current_user.id,
        ip_address=ip,
    )

    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=mimetype,
        headers={
            "Content-Disposition": f'attachment; filename="{original_name}"',
            "Content-Length": str(len(decrypted_bytes)),
        },
    )


@router.get("/{file_id}/stream")
def stream_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_query),
):
    ip = _get_client_ip(request)

    decrypted_bytes, original_name, mimetype = service.get_file_path(
        db,
        file_id,
        current_user.id,
        ip_address=ip,
        record_download=False,
    )

    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=mimetype or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{original_name}"',
            "Content-Length": str(len(decrypted_bytes)),
            "Accept-Ranges": "bytes",
        },
    )


@router.delete("/{file_id}", status_code=204)
def delete_file(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    service.delete_file(db, file_id, current_user.id, ip_address=ip)


@router.post("/{file_id}/rotate-key", status_code=200)
def rotate_key(
    file_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    service.rotate_file_key(
        db=db,
        file_id=file_id,
        owner_id=current_user.id,
        ip_address=ip,
    )
    return {"message": "Encryption key rotated successfully."}


@router.get("/{file_id}/versions", response_model=models.FileVersionListResponse)
def get_file_versions(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.list_file_versions(db, file_id, current_user.id)


@router.post("/{file_id}/versions", response_model=models.FileOut, status_code=201)
def upload_version(
    file_id: int,
    request: Request,
    file: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    return service.upload_new_version(db, file_id, file, current_user.id, ip_address=ip)


@router.post("/{file_id}/versions/{version_id}/restore", response_model=models.FileOut)
def restore_version(
    file_id: int,
    version_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    return service.restore_file_version(db, file_id, version_id, current_user.id, ip_address=ip)


@router.get("/{file_id}/versions/{version_id}/download")
def download_version(
    file_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decrypted_bytes, filename, mimetype = service.download_historical_version(
        db, file_id, version_id, current_user.id
    )
    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=mimetype,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(decrypted_bytes)),
        },
    )
