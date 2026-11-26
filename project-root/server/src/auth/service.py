# server/src/auth/service.py

import os
import random
import secrets
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from threading import Lock
from sqlalchemy.orm import Session
from fastapi import HTTPException, status, Request
from dotenv import load_dotenv

from src.entities.user import User
from src.auth.models import SignupRequest, TokenResponse, UserOut
from src.auth.dependencies import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from src.auth import email_service
from src.notifications.service import create_notification

from src.analytics.services import log_event
from src.analytics.constants import (
    AnalyticsEventType,
    AnalyticsEventStatus,
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

otp_store = {}
_used_reset_tokens: set[str] = set()

DEFAULT_DEV_DUMMY_EMAIL_DOMAINS = "example.com,test.com,invalid,localhost"


# ═══════════════════════════════════════════════════════════════════════════
# LOGIN RATE LIMITING (Brute force protection)
# ═══════════════════════════════════════════════════════════════════════════

_login_attempts_email: dict[str, list[float]] = defaultdict(list)
_login_attempts_ip: dict[str, list[float]] = defaultdict(list)
_login_attempts_lock = Lock()

LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_MAX_PER_EMAIL = 5
LOGIN_MAX_PER_IP = 20


def _check_login_rate_limit(email: str, ip_address: str | None) -> tuple[bool, int]:
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - LOGIN_WINDOW_SECONDS
    email_lower = (email or "").lower().strip()

    with _login_attempts_lock:
        _login_attempts_email[email_lower] = [
            t for t in _login_attempts_email[email_lower] if t > cutoff
        ]
        if len(_login_attempts_email[email_lower]) >= LOGIN_MAX_PER_EMAIL:
            oldest = _login_attempts_email[email_lower][0]
            retry_after = int(oldest + LOGIN_WINDOW_SECONDS - now)
            return False, max(1, retry_after)

        if ip_address:
            _login_attempts_ip[ip_address] = [
                t for t in _login_attempts_ip[ip_address] if t > cutoff
            ]
            if len(_login_attempts_ip[ip_address]) >= LOGIN_MAX_PER_IP:
                oldest = _login_attempts_ip[ip_address][0]
                retry_after = int(oldest + LOGIN_WINDOW_SECONDS - now)
                return False, max(1, retry_after)

    return True, 0


def _record_failed_login(email: str, ip_address: str | None) -> None:
    now = datetime.now(timezone.utc).timestamp()
    email_lower = (email or "").lower().strip()
    with _login_attempts_lock:
        _login_attempts_email[email_lower].append(now)
        if ip_address:
            _login_attempts_ip[ip_address].append(now)


def _clear_login_attempts(email: str, ip_address: str | None) -> None:
    email_lower = (email or "").lower().strip()
    with _login_attempts_lock:
        _login_attempts_email.pop(email_lower, None)
        if ip_address:
            _login_attempts_ip.pop(ip_address, None)


# ═══════════════════════════════════════════════════════════════════════════
# ENVIRONMENT HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def _environment() -> str:
    return os.getenv("ENVIRONMENT", "development").strip().lower()


def _development_dummy_email_domains() -> set[str]:
    configured = os.getenv("DEV_DUMMY_EMAIL_DOMAINS", DEFAULT_DEV_DUMMY_EMAIL_DOMAINS)
    return {
        domain.strip().lower().lstrip("@")
        for domain in configured.split(",")
        if domain.strip()
    }


def _is_development_dummy_email(email: str) -> bool:
    if _environment() not in {"development", "dev"}:
        return False
    _, separator, domain = email.strip().lower().rpartition("@")
    return bool(separator and domain in _development_dummy_email_domains())


#  Explicit Bootstrap Admin Creation (Loaded Dynamically)

def _determine_role_and_plan(db: Session, email: str) -> tuple[str, str]:
    load_dotenv()
    if not os.path.exists(".env") and os.path.exists("../.env"):
        load_dotenv("../.env")

    bootstrap_email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
    email_lower = email.strip().lower()

    if bootstrap_email and email_lower == bootstrap_email:
        existing_admin = db.query(User).filter(User.role == "admin").first()
        if not existing_admin:
            return "admin", "enterprise"

    return "member", "free"


# ═══════════════════════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════════════

def authenticate_user(
    db: Session,
    email: str,
    password: str,
    ip_address: str | None = None,
) -> User | None:
    allowed, retry_after = _check_login_rate_limit(email, ip_address)
    if not allowed:
        log_event(
            db,
            event_type=AnalyticsEventType.SECURITY,
            user_id=None,
            status=AnalyticsEventStatus.FAILED,
            ip_address=ip_address,
            event_metadata={
                "severity_key": "brute_force",
                "label": "Login rate limit exceeded",
                "detail": f"Too many login attempts for {email}",
                "target": email,
                "attempts": LOGIN_MAX_PER_EMAIL,
            },
        )
        db.commit()
        minutes = max(1, retry_after // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Try again in {minutes} minute{'s' if minutes > 1 else ''}.",
            headers={"Retry-After": str(retry_after)},
        )

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.hashed_password):
        _record_failed_login(email, ip_address)

        log_event(
            db,
            event_type=AnalyticsEventType.LOGIN,
            user_id=user.id if user else None,
            status=AnalyticsEventStatus.FAILED,
            ip_address=ip_address,
            event_metadata={
                "target": email,
                "attempts": 1,
                "severity_key": "login_failed",
            },
        )

        # ── SECURITY NOTIFICATION: Alert user about failed login attempt ──
        if user:
            create_notification(
                db,
                user_id=user.id,
                type="security",
                category="security",
                title="Failed login attempt",
                message=f"Someone tried to sign in to your account from {ip_address or 'an unknown location'}. If this wasn't you, change your password immediately.",
                icon="shield",
            )

        db.commit()
        return None

    _clear_login_attempts(email, ip_address)

    log_event(
        db,
        event_type=AnalyticsEventType.LOGIN,
        user_id=user.id,
        status=AnalyticsEventStatus.SUCCESS,
        ip_address=ip_address,
        event_metadata={"target": email},
    )
    db.commit()
    return user


def register_user(
    db: Session,
    data: SignupRequest,
    request=None,
    ip_address: str | None = None,
) -> TokenResponse:
    from src.auth.registration import normalize, consume, VerifiedEmail, now
    from sqlalchemy import func
    from sqlalchemy.exc import IntegrityError
    if len(data.password.encode('utf-8')) > 72:
        raise HTTPException(422, 'Password must be at most 72 bytes.')
    data.email = normalize(str(data.email))
    consume(db, data.email, data.verification_token)
    existing = db.query(User).filter(func.lower(User.email) == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    role, plan = _determine_role_and_plan(db, data.email)

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=role,
        plan=plan,
    )

    try:
        db.add(user)
        db.flush()
        db.add(VerifiedEmail(user_id=user.id, email=data.email, method='registration_otp', verified_at=now()))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'This address cannot be registered. Try signing in.') from None
    db.refresh(user)

    log_event(
        db,
        event_type=AnalyticsEventType.LOGIN,
        user_id=user.id,
        status=AnalyticsEventStatus.SUCCESS,
        ip_address=ip_address,
        event_metadata={"action": "register", "target": data.email},
    )
    db.commit()

    return _build_token_response(user, db=db, request=request)


def _build_token_response(user: User, db: Session = None, request=None) -> TokenResponse:
    import hashlib
    if db is not None and request is not None:
        # Serialize issuance for the existing single-current-session account policy.
        db.query(User).filter(User.id == user.id).with_for_update().one()
    token_data = {"sub": str(user.id), "jti": secrets.token_urlsafe(24)}
    refresh_token = create_refresh_token(token_data)
    access_token = create_access_token({**token_data, 'session': hashlib.sha256(refresh_token.encode()).hexdigest()})

    if db is not None and request is not None:
        try:
            from src.entities.login_session import LoginSession
            ua_string = request.headers.get("user-agent", "")
            ua = None
            try:
                from user_agents import parse as parse_ua
                ua = parse_ua(ua_string) if ua_string else None
            except ImportError:
                pass
            except Exception:
                pass

            # ── 1. Determine Device Type ──
            if ua:
                if ua.is_pc:
                    device_type = "desktop"
                elif ua.is_tablet:
                    device_type = "tablet"
                elif ua.is_mobile:
                    device_type = "mobile"
                else:
                    device_type = "desktop" if "windows" in ua_string.lower() or "macintosh" in ua_string.lower() else "unknown"
            else:
                device_type = "desktop" if "windows" in ua_string.lower() or "macintosh" in ua_string.lower() else "unknown"

            # ── 2. Extract OS Name & Brand ──
            os_name = ua.os.family if (ua and ua.os) else ""
            if "mac os x" in os_name.lower() or "macos" in os_name.lower():
                os_name = "macOS"
            elif "windows" in os_name.lower():
                os_name = "Windows"

            # ── 3. Format Accurate Browser Name with Version ──
            if ua and ua.browser and ua.browser.family:
                browser_name = ua.browser.family
                if ua.browser.version_string:
                    browser_name = f"{browser_name} {ua.browser.version_string.split('.')[0]}"
            elif ua_string:
                ua_lower = ua_string.lower()
                if 'edg/' in ua_lower or 'edge/' in ua_lower:
                    browser_name = 'Microsoft Edge'
                elif 'opr/' in ua_lower or 'opera' in ua_lower:
                    browser_name = 'Opera'
                elif 'brave' in ua_lower:
                    browser_name = 'Brave'
                elif 'vivaldi' in ua_lower:
                    browser_name = 'Vivaldi'
                elif 'firefox/' in ua_lower:
                    browser_name = 'Firefox'
                elif 'safari/' in ua_lower and 'chrome/' not in ua_lower:
                    browser_name = 'Safari'
                elif 'chrome/' in ua_lower:
                    browser_name = 'Chrome'
                else:
                    browser_name = ua_string.split('/')[0] if '/' in ua_string else 'Unknown'
            else:
                browser_name = "Unknown"

            # ── 4. Generate Figma-Grade Device Names ──
            device_name = None
            if ua:
                if ua.is_pc:
                    if os_name == "macOS":
                        device_name = "MacBook Pro"
                    elif os_name == "Windows":
                        device_name = "Windows PC"
                    elif os_name:
                        device_name = f"{os_name} PC"
                    else:
                        device_name = "Desktop Computer"
                else:
                    brand = ua.device.brand or ""
                    family = ua.device.family or ""

                    if "iphone" in family.lower() or "iphone" in ua_string.lower():
                        device_name = "iPhone"
                    elif "ipad" in family.lower() or "ipad" in ua_string.lower():
                        device_name = "iPad"
                    elif family and family != "Other":
                        device_name = f"{brand} {family}".strip()
                    else:
                        device_name = f"{os_name} Mobile" if os_name else "Mobile Device"
            else:
                ua_lower = ua_string.lower()
                if "iphone" in ua_lower:
                    device_name = "iPhone"
                elif "ipad" in ua_lower:
                    device_name = "iPad"
                elif "macintosh" in ua_lower or "mac os x" in ua_lower:
                    device_name = "MacBook Pro"
                elif "windows" in ua_lower:
                    device_name = "Windows PC"
                elif "android" in ua_lower:
                    device_name = "Android Device"
                else:
                    device_name = "Unknown Device"

            ip_address = None
            try:
                ip_address = request.client.host if request.client else None
            except Exception:
                ip_address = None

            location = "Unknown"

            try:
                db.query(LoginSession).filter(
                    LoginSession.user_id == user.id,
                    LoginSession.is_current == True
                ).update({"is_current": False})
            except Exception:
                pass

            session_row = LoginSession(
                user_id=user.id,
                device_name=device_name,
                browser_name=browser_name,
                device_type=device_type,
                ip_address=ip_address,
                location=location,
                last_active=None,
                refresh_token=refresh_token,
                is_current=True,
            )
            db.add(session_row)
            db.commit()
        except Exception as _session_err:
            try:
                print(f"[SESSION SAVE ERROR] {type(_session_err).__name__}", flush=True)
            except Exception:
                pass
            db.rollback()
            raise HTTPException(503, 'Could not establish your session. Please sign in again.') from None

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
        mfa_required=False,
    )


# ═══════════════════════════════════════════════════════════════════════════
# MFA HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def generate_otp(user_id: int, to_email: str = "", user_name: str = "") -> str:
    code = f"{secrets.randbelow(1000000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    otp_store[user_id] = {"otp": code, "expires_at": expires_at, "attempts": 0}


    if not to_email:
        otp_store.pop(user_id, None)
        raise HTTPException(503, "A delivery address is required for MFA.")
    try:
        email_service.send_otp_email(to_email, code, user_name)
    except Exception:
        otp_store.pop(user_id, None)
        raise HTTPException(503, "We could not send your verification email. Please try again later.") from None

    return code


def verify_otp_code(
    user_id: int,
    code: str,
    db: Session | None = None,
    ip_address: str | None = None,
) -> bool:
    entry = otp_store.get(user_id)

    if not entry:
        if db:
            log_event(db, event_type=AnalyticsEventType.SECURITY, user_id=user_id, status=AnalyticsEventStatus.FAILED, ip_address=ip_address,
                event_metadata={"severity_key": "login_failed", "label": "OTP verification failed", "detail": "No active OTP session found", "target": "otp", "attempts": 1})
            db.commit()
        return False

    entry["attempts"] = entry.get("attempts", 0) + 1
    if entry["attempts"] > 5:
        otp_store.pop(user_id, None)
        return False
    if not isinstance(code, str) or len(code) != 6 or not code.isascii() or not code.isdigit() or not secrets.compare_digest(entry["otp"], code):
        if db:
            log_event(db, event_type=AnalyticsEventType.SECURITY, user_id=user_id, status=AnalyticsEventStatus.FAILED, ip_address=ip_address,
                event_metadata={"severity_key": "login_failed", "label": "OTP verification failed", "detail": "Incorrect OTP code entered", "target": "otp", "attempts": 1})
            db.commit()
        return False

    if datetime.now(timezone.utc) > entry["expires_at"]:
        otp_store.pop(user_id, None)
        if db:
            log_event(db, event_type=AnalyticsEventType.SECURITY, user_id=user_id, status=AnalyticsEventStatus.FAILED, ip_address=ip_address,
                event_metadata={"severity_key": "login_failed", "label": "OTP expired", "detail": "OTP entered after expiry window", "target": "otp", "attempts": 1})
            db.commit()
        return False

    otp_store.pop(user_id, None)
    return True


def build_mfa_pending_response(user: User) -> TokenResponse:
    token_data = {"sub": str(user.id), "type": "mfa_pending"}
    mfa_token = create_access_token(token_data, expires_delta=timedelta(minutes=10))
    generate_otp(user.id, to_email=user.email, user_name=user.name)
    return TokenResponse(mfa_required=True, mfa_token=mfa_token)


# ═══════════════════════════════════════════════════════════════════════════
# PASSWORD RECOVERY
# ═══════════════════════════════════════════════════════════════════════════

def request_password_reset(db: Session, email: str):
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return

    token_data = {"sub": str(user.id), "type": "password_recovery"}
    reset_token = create_access_token(token_data, expires_delta=timedelta(minutes=15))

    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    email_service.send_reset_email(user.email, reset_link, user.name)


def reset_password_in_db(
    db: Session,
    token: str,
    new_password: str,
    ip_address: str | None = None,
) -> bool:
    from src.auth.dependencies import decode_token

    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    if payload.get("type") != "password_recovery":
        raise HTTPException(status_code=400, detail="Invalid token type")

    if token in _used_reset_tokens:
        raise HTTPException(status_code=400, detail="This password reset link has already been used.")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(new_password)
    _used_reset_tokens.add(token)

    if len(_used_reset_tokens) > 10000:
        _used_reset_tokens.clear()

    create_notification(
        db,
        user_id=user.id,
        type="security",
        category="security",
        title="Password reset completed",
        message="Your account password was successfully reset. If you did not request this, contact support immediately.",
        icon="shield",
    )

    db.commit()

    log_event(db, event_type=AnalyticsEventType.SECURITY, user_id=user.id, status=AnalyticsEventStatus.SUCCESS, ip_address=ip_address,
        event_metadata={"severity_key": "admin_role", "label": "Password reset completed", "detail": f"Password reset for {user.email}", "target": user.email, "attempts": 1})
    db.commit()

    return True


# ═══════════════════════════════════════════════════════════════════════════
# OAUTH
# ═══════════════════════════════════════════════════════════════════════════

def get_or_create_oauth_user(
    db: Session,
    provider: str,
    email: str,
    name: str,
    ip_address: str | None = None,
) -> User:
    from src.auth.registration import normalize
    from sqlalchemy import func
    email = normalize(email)
    user = db.query(User).filter(func.lower(User.email) == email).first()

    if not user:
        random_password = secrets.token_urlsafe(16)
        role, plan = _determine_role_and_plan(db, email)

        user = User(name=name, email=email, hashed_password=hash_password(random_password), role=role, plan=plan)
        db.add(user)
        db.commit()
        db.refresh(user)

        log_event(db, event_type=AnalyticsEventType.LOGIN, user_id=user.id, status=AnalyticsEventStatus.SUCCESS, ip_address=ip_address,
            event_metadata={"action": "oauth_register", "provider": provider, "target": email})
        db.commit()
    else:
        log_event(db, event_type=AnalyticsEventType.LOGIN, user_id=user.id, status=AnalyticsEventStatus.SUCCESS, ip_address=ip_address,
            event_metadata={"action": "oauth_login", "provider": provider, "target": email})
        db.commit()

    return user


# ═══════════════════════════════════════════════════════════════════════════
# MFA TOGGLE
# ═══════════════════════════════════════════════════════════════════════════

def enable_mfa(db: Session, user: User) -> User:
    user.mfa_enabled = True
    db.commit()
    db.refresh(user)

    create_notification(
        db,
        user_id=user.id,
        type="security",
        category="security",
        title="Multi-factor authentication enabled",
        message="MFA has been successfully activated on your account. All future logins will require a verification code.",
        icon="shield",
    )

    log_event(db, event_type=AnalyticsEventType.SECURITY, user_id=user.id, status=AnalyticsEventStatus.SUCCESS,
        event_metadata={"severity_key": "admin_role", "label": "MFA enabled", "detail": f"Multi-factor authentication enabled for {user.email}", "target": user.email, "attempts": 1})
    db.commit()

    return user


def disable_mfa(db: Session, user: User) -> User:
    user.mfa_enabled = False
    db.commit()
    db.refresh(user)

    create_notification(
        db,
        user_id=user.id,
        type="security",
        category="security",
        title="Multi-factor authentication disabled",
        message="MFA has been removed from your account. Your account is now less secure. Consider re-enabling MFA.",
        icon="shield",
    )

    log_event(db, event_type=AnalyticsEventType.SECURITY, user_id=user.id, status=AnalyticsEventStatus.WARNING,
        event_metadata={"severity_key": "unusual_access", "label": "MFA disabled", "detail": f"Multi-factor authentication disabled for {user.email}", "target": user.email, "attempts": 1})
    db.commit()

    return user


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> bool:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(new_password)
    try:
        from src.entities.login_session import LoginSession
        db.query(LoginSession).filter(
            LoginSession.user_id == user.id,
        ).update({"is_current": False}, synchronize_session=False)
    except Exception as _sess_err:
        print(f"[SESSION CLEANUP WARN] {type(_sess_err).__name__}: {_sess_err}", flush=True)

    create_notification(
        db,
        user_id=user.id,
        type="security",
        category="security",
        title="Password changed successfully",
        message="Your account password was updated. All other active sessions have been logged out.",
    )

    db.commit()
    return True
