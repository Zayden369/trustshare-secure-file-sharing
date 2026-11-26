# server/src/shares/controller.py

from io import BytesIO
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.core import get_db
from src.auth.dependencies import get_current_user
from src.entities.user import User
from src.shares.service import (
    ShareCreate,
    ShareUpdateRequest,
    ShareOut,
    PublicShareOut,
    create_share,
    list_shares,
    revoke_share,
    archive_share,
    access_share,
    inspect_public_share,
    get_public_file_path,
    update_share_permission,
    check_user_expirations, # Added check
)

router = APIRouter()


def _get_client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


@router.get("", response_model=list[ShareOut])
@router.get("/", response_model=list[ShareOut], include_in_schema=False)
def my_shares(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Proactively scan and update link lifecycles before returning list
    check_user_expirations(db, current_user.id)
    return list_shares(db, current_user.id)


@router.post("", response_model=ShareOut, status_code=201)
@router.post("/", response_model=ShareOut, status_code=201, include_in_schema=False)
def create(
    data: ShareCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    return create_share(db, data, current_user.id, ip_address=ip)


@router.patch("/{share_id}", response_model=ShareOut)
@router.patch("/{share_id}/", response_model=ShareOut, include_in_schema=False)
def update_share(
    share_id: int,
    data: ShareUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return update_share_permission(db, share_id, data.permission, current_user.id)


@router.delete("/{share_id}", status_code=204)
@router.delete("/{share_id}/", status_code=204, include_in_schema=False)
def revoke(
    share_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ip = _get_client_ip(request)
    revoke_share(db, share_id, current_user.id, ip_address=ip)


@router.delete("/{share_id}/record", status_code=204)
def delete_inactive_record(share_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    archive_share(db, share_id, current_user.id)


@router.get("/access/{token}", response_model=ShareOut)
@router.get("/access/{token}/", response_model=ShareOut, include_in_schema=False)
def public_access(
    token: str,
    request: Request,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    ip = _get_client_ip(request)
    return access_share(
        db,
        token,
        password=password,
        ip_address=ip,
        user_id=None,
    )


@router.get("/public/{token}", response_model=PublicShareOut)
@router.get("/public/{token}/", response_model=PublicShareOut, include_in_schema=False)
def public_details(
    token: str,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return inspect_public_share(db, token, password=password)


@router.get("/public/{token}/content")
@router.get("/public/{token}/content/", include_in_schema=False)
def public_content(
    token: str,
    request: Request,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    decrypted_bytes, original_name, mimetype, permission = get_public_file_path(
        db,
        token,
        password=password,
        ip_address=_get_client_ip(request),
    )

    disposition = "attachment" if permission == "download" else "inline"
    return StreamingResponse(
        BytesIO(decrypted_bytes),
        media_type=mimetype or "application/octet-stream",
        headers={
            "Content-Disposition": f'{disposition}; filename="{original_name}"',
            "Content-Length": str(len(decrypted_bytes)),
        },
    )
