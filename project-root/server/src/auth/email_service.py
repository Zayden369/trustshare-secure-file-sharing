"""
email_service.py
Sends real emails via SMTP (works with Gmail, Outlook, or any SMTP provider).
Reads credentials from environment variables — never hardcodes secrets.
"""
import os
import smtplib
import ssl
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# Read SMTP settings from environment (set in .env file)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


class EmailDeliveryError(RuntimeError):
    """SMTP did not accept the message; contains no credentials or message body."""


def _failure_reason(exc: Exception) -> str:
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return "smtp_authentication_failed"
    if isinstance(exc, smtplib.SMTPResponseException):
        response = str(exc.smtp_error).lower()
        if "not verified" in response:
            return "ses_identity_not_verified_check_sandbox"
        return f"smtp_rejected_{exc.smtp_code}"
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return "recipient_rejected"
    return "smtp_unavailable"


def _is_development() -> bool:
    return os.getenv("ENVIRONMENT", "development").strip().lower() in {
        "development",
        "dev",
    }


def _send_email(to_email: str, subject: str, html_body: str, plain_body: str | None = None):
    """Internal helper: opens SMTP connection and sends one email."""
    if not SMTP_USER or not SMTP_PASSWORD:
        raise EmailDeliveryError('smtp_not_configured')

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email
    if plain_body:
        msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(EMAIL_FROM, to_email, msg.as_string())
        print(f"[EMAIL] SMTP accepted '{subject}'", flush=True)
    except Exception as exc:
        # Report the failure without exposing credentials or message contents.
        reason = _failure_reason(exc)
        print(f"[EMAIL ERROR] {reason}", flush=True)
        raise EmailDeliveryError(reason) from None


def _send_in_background(to_email: str, subject: str, html_body: str):
    """Send email in a background thread so the API response is not delayed."""
    def deliver():
        try:
            _send_email(to_email, subject, html_body)
        except EmailDeliveryError:
            pass  # Already logged safely; never log reset links or OTPs.

    thread = threading.Thread(target=deliver, daemon=True)
    thread.start()


# ── Public functions ───────────────────────────────────────────────────────────

def send_otp_email(to_email: str, otp_code: str, user_name: str = ""):
    """Send a 6-digit OTP verification email to the user."""
    subject = "Your TrustShare Verification Code"
    greeting = f"Hi {user_name}," if user_name else "Hi,"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;
                background:#0a162b;color:#e2e8f0;border-radius:12px;">
      <h2 style="color:#3b82f6;margin-bottom:8px;">🔐 TrustShare Security Verification</h2>
      <p>{greeting}</p>
      <p>Your one-time verification code is:</p>
      <div style="font-size:36px;font-weight:900;letter-spacing:10px;color:#fff;
                  background:#0d1e3d;padding:20px;border-radius:8px;
                  text-align:center;margin:24px 0;">{otp_code}</div>
      <p style="color:#94a3b8;font-size:13px;">
        This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
      </p>
      <hr style="border-color:#1e293b;margin:24px 0;">
      <p style="color:#64748b;font-size:12px;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
    """
    # Login/setup/resend must not claim success when the SMTP provider rejects it.
    _send_email(to_email, subject, html_body)


def send_reset_email(to_email: str, reset_link: str, user_name: str = ""):
    """Send a password reset link email to the user."""
    subject = "Reset Your TrustShare Password"
    greeting = f"Hi {user_name}," if user_name else "Hi,"
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;
                background:#0a162b;color:#e2e8f0;border-radius:12px;">
      <h2 style="color:#3b82f6;margin-bottom:8px;">🔑 TrustShare Password Reset</h2>
      <p>{greeting}</p>
      <p>We received a request to reset your TrustShare password.
         Click the button below to set a new password:</p>
      <a href="{reset_link}"
         style="display:inline-block;margin:24px 0;padding:14px 28px;
                background:#3b82f6;color:#fff;text-decoration:none;
                border-radius:8px;font-weight:700;font-size:15px;">
        Reset Password
      </a>
      <p style="color:#94a3b8;font-size:13px;">
        This link expires in <strong>15 minutes</strong>.
        If you did not request a password reset, ignore this email — your password will not change.
      </p>
      <hr style="border-color:#1e293b;margin:24px 0;">
      <p style="color:#64748b;font-size:12px;">
        If the button above doesn't work, copy and paste this URL into your browser:<br>
        <a href="{reset_link}" style="color:#3b82f6;">{reset_link}</a>
      </p>
    </div>
    """
    _send_in_background(to_email, subject, html_body)


def send_registration_email(to_email: str, code: str):
    if not SMTP_USER or not SMTP_PASSWORD:
        raise EmailDeliveryError('smtp_not_configured')
    plain = f"Welcome to TrustShare. Your email verification code is {code}. It expires in 5 minutes. If you did not request it, ignore this message. Your files. Your security. Your control."
    html = f'<div style="font:16px Arial;background:#fafafa;color:#141416;padding:32px;max-width:480px;margin:auto"><h2>t. TrustShare</h2><p>Confirm your email address to complete registration.</p><p style="font:32px monospace;letter-spacing:8px;color:#4f46e5">{code}</p><p>This code expires in 5 minutes.</p><p>If you did not request this, you can safely ignore this email.</p><small>Your files. Your security. Your control.</small></div>'
    _send_email(to_email, 'Verify your TrustShare email address', html, plain)
