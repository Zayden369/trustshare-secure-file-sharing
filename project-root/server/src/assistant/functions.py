"""
Assistant Function Handlers — TrustShare AI Assistant

Python implementations of the functions the LLM can call.
Each handler receives (db, user, args) and returns a JSON-serializable dict.

Handlers are registered in FUNCTION_REGISTRY. When LLM calls a function
by name, we look it up and execute it with the provided args.

New functions require:
1. A handler function here
2. An entry in FUNCTION_REGISTRY
3. A row in assistant_functions table (with matching function_name)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, or_, case
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from typing import Literal, Optional
from sqlalchemy.orm import Session

from src.entities.file import File
from src.entities.file_permission import FilePermission
from src.entities.share_link import ShareLink, ShareLinkArchive
from src.entities.notification import Notification
from src.entities.login_session import LoginSession
from src.entities.user import User

logger = logging.getLogger(__name__)

# HELPERS


def _format_size(size_bytes: int) -> str:
    """Human-readable file size."""
    if size_bytes is None:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} PB"


def _format_date(dt: datetime) -> str:
    """Human-friendly date."""
    if not dt:
        return "Unknown"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    diff = now - dt
    if diff.days == 0:
        return "Today"
    if diff.days == 1:
        return "Yesterday"
    if diff.days < 7:
        return f"{diff.days} days ago"
    if diff.days < 30:
        return f"{diff.days // 7} week(s) ago"
    return dt.strftime("%b %d, %Y")


def _classify_file(mimetype: str) -> str:
    """Classify file into a category."""
    mt = (mimetype or "").lower()
    if "pdf" in mt:
        return "pdf"
    if "presentation" in mt or "powerpoint" in mt:
        return "presentation"
    if "spreadsheet" in mt or "excel" in mt:
        return "spreadsheet"
    if "image" in mt:
        return "image"
    if "video" in mt:
        return "video"
    if "audio" in mt:
        return "audio"
    if any(x in mt for x in ["word", "document", "text"]):
        return "document"
    if any(
        x in mt for x in ["zip", "rar", "7z", "tar", "gzip", "archive", "compressed"]
    ):
        return "archive"
    return "other"


# FUNCTION HANDLERS


def list_files(db: Session, user: User, args: dict) -> dict:
    """Get user's files with optional filters."""
    file_type = args.get("file_type", "all")
    days_back = args.get("days_back")
    min_size_mb = args.get("min_size_mb")
    max_size_mb = args.get("max_size_mb")
    encrypted_only = args.get("encrypted_only", False)  # NEW

    from src.assistant import config_service

    default_limit = config_service.get_int(db, "DEFAULT_FUNCTION_LIMIT", 10)
    max_limit = config_service.get_int(db, "MAX_FUNCTION_LIMIT", 50)
    limit = min(args.get("limit", default_limit), max_limit)

    query = db.query(File).filter(
        File.owner_id == user.id,
        File.is_deleted == False,
    )
    if args.get("calendar_month"):
        now = datetime.now(timezone.utc)
        first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
        query = query.filter(File.created_at >= first, File.created_at < next_month)

    if days_back and days_back > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
        query = query.filter(File.created_at >= cutoff)

    if min_size_mb is not None:
        query = query.filter(File.size >= int(min_size_mb * 1024 * 1024))

    if max_size_mb is not None:
        query = query.filter(File.size <= int(max_size_mb * 1024 * 1024))

    if encrypted_only:
        query = query.filter(File.encrypted == True)

    if file_type and file_type != "all":
        query = query.filter(_category_sql() == file_type)
    total_matched = query.count()
    column = File.size if args.get("sort_by") == "size" else File.created_at
    order = column.asc() if args.get("sort_order") == "asc" else column.desc()
    files_shown = query.order_by(order, File.id.desc()).limit(limit).all()

    return {
        "total_matched": total_matched,
        "shown": len(files_shown),
        "filters_applied": {
            "file_type": file_type,
            "days_back": days_back,
            "min_size_mb": min_size_mb,
            "max_size_mb": max_size_mb,
            "encrypted_only": encrypted_only,  # NEW
            "calendar_month": args.get("calendar_month", False),
            "sort_by": args.get("sort_by", "created_at"),
        },
        "files": [
            {
                "id": f.id,
                "name": f.original_name,
                "size": _format_size(f.size),
                "size_bytes": f.size,
                "type": _classify_file(f.mimetype),
                "mimetype": f.mimetype,
                "encrypted": bool(f.encrypted),
                "created": _format_date(f.created_at),
                "download_count": f.download_count or 0,
            }
            for f in files_shown
        ],
    }


def search_files(db: Session, user: User, args: dict) -> dict:
    """Search files by name."""
    query_text = (args.get("query") or "").strip()

    from src.assistant import config_service

    default_limit = config_service.get_int(db, "DEFAULT_FUNCTION_LIMIT", 10)
    max_limit = config_service.get_int(db, "MAX_FUNCTION_LIMIT", 50)
    limit = min(args.get("limit", default_limit), max_limit)

    if not query_text:
        return {"total_matched": 0, "shown": 0, "files": [], "query": query_text}

    like_pattern = f"%{query_text}%"

    query = (
        db.query(File)
        .filter(
            File.owner_id == user.id,
            File.is_deleted == False,
            func.lower(File.original_name).like(func.lower(like_pattern)),
        )
    )
    total = query.count()
    results = query.order_by(File.created_at.desc(), File.id.desc()).limit(limit).all()

    return {
        "total_matched": total,
        "shown": len(results),
        "query": query_text,
        "files": [
            {
                "id": f.id,
                "name": f.original_name,
                "size": _format_size(f.size),
                "type": _classify_file(f.mimetype),
                "encrypted": bool(f.encrypted),
                "created": _format_date(f.created_at),
            }
            for f in results
        ],
    }


def get_storage_info(db: Session, user: User, args: dict) -> dict:
    """Get storage usage summary."""
    used = user.storage_used or 0
    quota = user.storage_quota or 0
    remaining = max(0, quota - used) if quota else None
    percent = round((used / quota * 100), 1) if quota else None

    return {
        "used": _format_size(used),
        "used_bytes": used,
        "quota": _format_size(quota) if quota else "Unlimited",
        "quota_bytes": quota,
        "remaining": _format_size(remaining) if remaining is not None else "Unlimited",
        "remaining_bytes": remaining,
        "usage_percent": percent,
        "plan": user.plan or "free",
    }


def get_storage_breakdown(db: Session, user: User, args: dict) -> dict:
    """Get storage usage by category."""
    files = (
        db.query(File.mimetype, func.coalesce(func.sum(File.size), 0), func.count(File.id))
        .filter(File.owner_id == user.id, File.is_deleted == False)
        .group_by(File.mimetype)
        .all()
    )

    categories = {
        "documents": {"size": 0, "count": 0},
        "media": {"size": 0, "count": 0},
        "archives": {"size": 0, "count": 0},
        "other": {"size": 0, "count": 0},
    }

    for mimetype, size, count in files:
        size = size or 0
        cat_key = _classify_file(mimetype)
        if cat_key in ("pdf", "document"):
            cat = "documents"
        elif cat_key in ("image", "video", "audio"):
            cat = "media"
        elif cat_key == "archive":
            cat = "archives"
        else:
            cat = "other"
        categories[cat]["size"] += size
        categories[cat]["count"] += count

    total = sum(c["size"] for c in categories.values())

    return {
        "total": _format_size(total),
        "total_bytes": total,
        "categories": [
            {
                "name": name.capitalize(),
                "size": _format_size(cat["size"]),
                "size_bytes": cat["size"],
                "count": cat["count"],
                "percent": round((cat["size"] / total * 100), 1) if total else 0,
            }
            for name, cat in categories.items()
            if cat["count"] > 0
        ],
    }


def find_shares(db: Session, user: User, args: dict) -> dict:
    """Get files the user has shared with others."""
    recipient_email = (args.get("recipient_email") or "").strip().lower()
    file_name = (args.get("file_name") or "").strip()
    active_only = args.get("active_only", True)
    days_back = args.get("days_back")  # NEW

    # Direct file permissions
    perm_query = (
        db.query(FilePermission, File, User)
        .join(File, FilePermission.file_id == File.id)
        .join(User, FilePermission.user_id == User.id)
        .filter(
            FilePermission.granted_by == user.id,
            File.owner_id == user.id,
            File.is_deleted == False,
        )
    )

    if recipient_email:
        perm_query = perm_query.filter(
            func.lower(User.email).like(f"%{recipient_email}%")
        )

    if file_name:
        perm_query = perm_query.filter(
            func.lower(File.original_name).like(f"%{file_name.lower()}%")
        )

    # NEW: Date filter on permissions
    if days_back and days_back > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
        if hasattr(FilePermission, "created_at"):
            perm_query = perm_query.filter(FilePermission.created_at >= cutoff)

    perm_shares = [] if args.get("links_only") else perm_query.limit(50).all()

    link_query = (
        db.query(ShareLink, File)
        .join(File, ShareLink.file_id == File.id)
        .filter(
            ShareLink.created_by == user.id,
            File.owner_id == user.id,
            File.is_deleted == False,
            ~ShareLink.id.in_(db.query(ShareLinkArchive.share_id)),
        )
    )

    if active_only:
        now = datetime.now(timezone.utc)
        link_query = link_query.filter(
            ShareLink.is_active == True,
            or_(ShareLink.expires_at == None, ShareLink.expires_at > now),
            or_(ShareLink.max_views == None, ShareLink.access_count < ShareLink.max_views),
        )

    if file_name:
        link_query = link_query.filter(
            func.lower(File.original_name).like(f"%{file_name.lower()}%")
        )

    if days_back and days_back > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
        link_query = link_query.filter(ShareLink.created_at >= cutoff)

    links = link_query.limit(50).all()

    return {
        "direct_shares_count": len(perm_shares),
        "share_links_count": len(links),
        "filters_applied": {  # NEW
            "recipient_email": recipient_email or None,
            "file_name": file_name or None,
            "days_back": days_back,
        },
        "direct_shares": [
            {
                "file_name": f.original_name,
                "file_size": _format_size(f.size),
                "recipient_name": recipient.name,
                "recipient_email": recipient.email,
                "permission": perm.permission_level,
                "shared_on": (
                    _format_date(perm.created_at)
                    if hasattr(perm, "created_at")
                    else "Unknown"
                ),
            }
            for perm, f, recipient in perm_shares
        ],
        "share_links": [
            {
                "file_name": f.original_name,
                "file_size": _format_size(f.size),
                "is_active": bool(link.is_active),
                "access_count": link.access_count or 0,
                "expires": (
                    _format_date(link.expires_at) if link.expires_at else "Never"
                ),
                "created": _format_date(link.created_at),
            }
            for link, f in links
        ],
    }


def get_user_profile(db: Session, user: User, args: dict) -> dict:
    """Return the user's profile info."""
    return {
        "name": user.name,
        "email": user.email,
        "organization": user.organization or "Not set",
        "role": user.role,
        "plan": user.plan or "free",
        "mfa_enabled": bool(user.mfa_enabled),
        "member_since": _format_date(user.created_at),
        "is_active": bool(user.is_active),
    }


def list_active_sessions(db: Session, user: User, args: dict) -> dict:
    """Return user's active login sessions."""
    sessions = (
        db.query(LoginSession)
        .filter(LoginSession.user_id == user.id, LoginSession.is_current == True,
                LoginSession.refresh_token != None)
        .order_by(
            LoginSession.is_current.desc(),
            LoginSession.created_at.desc(),
        )
        .limit(20)
        .all()
    )
    from src.auth.dependencies import decode_token
    from fastapi import HTTPException
    valid = []
    for session in sessions:
        try:
            payload = decode_token(session.refresh_token)
            if payload.get("type") == "refresh" and str(payload.get("sub")) == str(user.id):
                valid.append(session)
        except HTTPException:
            continue
    sessions = valid

    return {
        "total_sessions": len(sessions),
        "current_session_count": sum(1 for s in sessions if s.is_current),
        "other_session_count": sum(1 for s in sessions if not s.is_current),
        "sessions": [
            {
                "device": s.device_name or "Unknown device",
                "browser": s.browser_name or "Unknown browser",
                "device_type": s.device_type or "unknown",
                "location": s.location or "Unknown",
                "ip": s.ip_address or "Unknown",
                "is_current": bool(s.is_current),
                "last_active": (
                    _format_date(s.last_active)
                    if s.last_active
                    else _format_date(s.created_at)
                ),
            }
            for s in sessions
        ],
    }


def get_notifications(db: Session, user: User, args: dict) -> dict:
    """Return user's notifications."""
    unread_only = args.get("unread_only", True)

    from src.assistant import config_service

    default_limit = config_service.get_int(db, "DEFAULT_FUNCTION_LIMIT", 10)
    max_limit = config_service.get_int(db, "MAX_FUNCTION_LIMIT", 50)
    limit = min(args.get("limit", default_limit), max_limit)

    query = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()

    return {
        "total_matched": total,
        "unread_only": unread_only,
        "shown": len(notifications),
        "notifications": [
            {
                "title": getattr(n, "title", None) or "Notification",
                "message": getattr(n, "message", None) or "",
                "is_read": bool(getattr(n, "is_read", False)),
                "created": _format_date(n.created_at),
            }
            for n in notifications
        ],
    }


# REGISTRY

FUNCTION_REGISTRY = {
    "list_files": list_files,
    "search_files": search_files,
    "get_storage_info": get_storage_info,
    "get_storage_breakdown": get_storage_breakdown,
    "find_shares": find_shares,
    "get_user_profile": get_user_profile,
    "list_active_sessions": list_active_sessions,
    "get_notifications": get_notifications,
}


def execute_function(
    function_name: str,
    args: dict,
    db: Session,
    user: User,
) -> dict:
    handler = FUNCTION_REGISTRY.get(function_name)

    if not handler:
        logger.warning(f"Unknown function called by LLM: {function_name}")
        return {
            "error": True,
            "message": f"Function '{function_name}' is not available.",
        }

    try:
        from src.entities.assistant_function import AssistantFunction
        policy = db.query(AssistantFunction).filter(AssistantFunction.function_name == function_name).first()
        if not user.is_active or not policy or not policy.is_active or (policy.requires_admin and user.role != "admin"):
            return {"error": True, "message": "This operation is not available for your account."}
        validated = ARGUMENT_MODELS[function_name].model_validate(args).model_dump(exclude_none=True)
        result = handler(db, user, validated)
        logger.debug(f"Function {function_name} executed successfully")
        return result
    except ValidationError:
        return {"error": True, "message": "The operation arguments are invalid."}
    except Exception as e:
        logger.error(
            "Assistant operation failed: %s %s", function_name, type(e).__name__,
        )
        return {
            "error": True,
            "message": "The function encountered an error. Please try rephrasing.",
        }


def _category_sql():
    mt = func.lower(func.coalesce(File.mimetype, ""))
    return case(
        (mt.contains("pdf"), "pdf"),
        (or_(mt.contains("presentation"), mt.contains("powerpoint")), "presentation"),
        (or_(mt.contains("spreadsheet"), mt.contains("excel")), "spreadsheet"),
        (mt.contains("image"), "image"), (mt.contains("video"), "video"), (mt.contains("audio"), "audio"),
        (or_(*[mt.contains(x) for x in ["word", "document", "text"]]), "document"),
        (or_(*[mt.contains(x) for x in ["zip", "rar", "7z", "tar", "gzip", "archive", "compressed"]]), "archive"),
        else_="other",
    )


class EmptyArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LimitArgs(EmptyArgs):
    limit: Optional[int] = Field(default=None, ge=1, le=50)


class FileArgs(LimitArgs):
    file_type: Literal["all", "pdf", "document", "image", "video", "audio", "archive", "presentation", "spreadsheet", "other"] = "all"
    days_back: Optional[int] = Field(default=None, ge=1, le=3650)
    min_size_mb: Optional[float] = Field(default=None, ge=0, le=1e6)
    max_size_mb: Optional[float] = Field(default=None, ge=0, le=1e6)
    encrypted_only: bool = False
    calendar_month: bool = False
    sort_by: Literal["created_at", "size"] = "created_at"
    sort_order: Literal["asc", "desc"] = "desc"


class SearchArgs(LimitArgs):
    query: str = Field(min_length=1, max_length=255)


class ShareArgs(EmptyArgs):
    recipient_email: str = Field(default="", max_length=254)
    file_name: str = Field(default="", max_length=255)
    active_only: bool = True
    links_only: bool = False
    days_back: Optional[int] = Field(default=None, ge=1, le=3650)


class NotificationArgs(LimitArgs):
    unread_only: bool = True


ARGUMENT_MODELS = {
    "list_files": FileArgs, "search_files": SearchArgs, "find_shares": ShareArgs,
    "get_notifications": NotificationArgs, "get_storage_info": EmptyArgs,
    "get_storage_breakdown": EmptyArgs, "get_user_profile": EmptyArgs, "list_active_sessions": EmptyArgs,
}
