"""Isolated auth regression tests; no live SMTP, OAuth, or database required.

Run: python -m pytest --confcutdir=tests/auth_regression tests/auth_regression
"""
import asyncio
import smtplib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.auth import controller, email_service, models, service
from src.auth.dependencies import decode_token, get_current_user


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    service.otp_store.clear()
    controller._oauth_token_store.clear()
    yield
    service.otp_store.clear()
    controller._oauth_token_store.clear()


def user_and_db(mfa=True, active=True):
    user = SimpleNamespace(id=21, name="Test user", email="recipient@example.net",
                           is_active=active, mfa_enabled=mfa)
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = user
    return user, db


def request():
    return Request({"type": "http", "query_string": b"state=browser-state", "headers": [(b"cookie",b"trustshare_google_state=browser-state")], "client": ("127.0.0.1", 1234)})


@pytest.mark.parametrize("recipient", ["one@example.net", "two@example.org"])
def test_smtp_sends_to_each_user_not_the_sender(monkeypatch, recipient):
    smtp = MagicMock()
    factory = MagicMock()
    factory.return_value.__enter__.return_value = smtp
    monkeypatch.setattr(email_service.smtplib, "SMTP", factory)
    monkeypatch.setattr(email_service, "SMTP_USER", "smtp-login")
    monkeypatch.setattr(email_service, "SMTP_PASSWORD", "not-a-real-secret")
    monkeypatch.setattr(email_service, "EMAIL_FROM", "sender@example.com")
    email_service.send_otp_email(recipient, "123456", "Test")
    assert smtp.sendmail.call_args.args[:2] == ("sender@example.com", recipient)
    smtp.starttls.assert_called_once()
    assert factory.call_args.kwargs["timeout"] == 15


def test_ses_rejection_is_safe_and_propagates(monkeypatch, capsys):
    smtp = MagicMock()
    smtp.sendmail.side_effect = smtplib.SMTPDataError(
        554, b"Email address is not verified: private@example.net"
    )
    factory = MagicMock()
    factory.return_value.__enter__.return_value = smtp
    monkeypatch.setattr(email_service.smtplib, "SMTP", factory)
    monkeypatch.setattr(email_service, "SMTP_USER", "smtp-login")
    monkeypatch.setattr(email_service, "SMTP_PASSWORD", "do-not-print")
    with pytest.raises(email_service.EmailDeliveryError, match="ses_identity_not_verified"):
        email_service.send_otp_email("private@example.net", "987654")
    output = capsys.readouterr().out
    assert "987654" not in output
    assert "do-not-print" not in output
    assert "private@example.net" not in output


def test_missing_credentials_fail_closed(monkeypatch):
    monkeypatch.setattr(email_service, "SMTP_USER", "")
    with pytest.raises(email_service.EmailDeliveryError, match="smtp_not_configured"):
        email_service.send_otp_email("recipient@example.net", "123456")


def test_production_otp_failure_does_not_leave_a_usable_challenge(monkeypatch):
    monkeypatch.setattr(email_service, "send_otp_email", MagicMock(
        side_effect=email_service.EmailDeliveryError("recipient_rejected")))
    with pytest.raises(HTTPException) as error:
        service.generate_otp(21, "recipient@example.net")
    assert error.value.status_code == 503
    assert 21 not in service.otp_store


def test_oauth_mfa_exchange_sends_to_user_and_issues_no_session(monkeypatch):
    user, db = user_and_db()
    send = MagicMock()
    session = MagicMock()
    monkeypatch.setattr(email_service, "send_otp_email", send)
    monkeypatch.setattr(service, "_build_token_response", session)
    code = controller._store_oauth_user(user.id)
    result = controller.oauth_exchange(models.OAuthExchangeRequest(code=code), request(), db)
    assert result["mfa_required"] is True
    assert result["access_token"] is None and result["refresh_token"] is None
    assert result["email"] == user.email
    assert decode_token(result["mfa_token"])["type"] == "mfa_pending"
    assert send.call_args.args[0] == user.email
    session.assert_not_called()
    with pytest.raises(HTTPException) as error:
        get_current_user(result["mfa_token"], db)
    assert error.value.status_code == 401
    with pytest.raises(HTTPException):
        controller.oauth_exchange(models.OAuthExchangeRequest(code=code), request(), db)


def test_oauth_delivery_failure_issues_no_session(monkeypatch):
    user, db = user_and_db()
    monkeypatch.setattr(email_service, "send_otp_email", MagicMock(
        side_effect=email_service.EmailDeliveryError("smtp_unavailable")))
    session = MagicMock()
    monkeypatch.setattr(service, "_build_token_response", session)
    code = controller._store_oauth_user(user.id)
    with pytest.raises(HTTPException) as error:
        controller.oauth_exchange(models.OAuthExchangeRequest(code=code), request(), db)
    assert error.value.status_code == 503
    session.assert_not_called()


def test_oauth_without_mfa_issues_normal_session(monkeypatch):
    user, db = user_and_db(mfa=False)
    response = models.TokenResponse(access_token="access", refresh_token="refresh")
    session = MagicMock(return_value=response)
    monkeypatch.setattr(service, "_build_token_response", session)
    code = controller._store_oauth_user(user.id)
    assert controller.oauth_exchange(models.OAuthExchangeRequest(code=code), request(), db) == response
    session.assert_called_once()


@pytest.mark.parametrize("expired,active", [(True, True), (False, False)])
def test_oauth_exchange_rejects_expired_or_suspended(monkeypatch, expired, active):
    user, db = user_and_db(active=active)
    code = controller._store_oauth_user(user.id)
    if expired:
        controller._oauth_token_store[code]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    session = MagicMock()
    monkeypatch.setattr(service, "_build_token_response", session)
    with pytest.raises(HTTPException):
        controller.oauth_exchange(models.OAuthExchangeRequest(code=code), request(), db)
    session.assert_not_called()


@pytest.mark.parametrize("provider", ["google"])
def test_oauth_callbacks_store_identity_not_full_tokens(monkeypatch, provider):
    user, db = user_and_db()
    client = MagicMock()
    client.fetch_token = AsyncMock(return_value={})
    profile = {"email": user.email, "name": user.name, "mail": user.email, "displayName": user.name, "email_verified": True}
    client.get = AsyncMock(return_value=SimpleNamespace(json=lambda: profile))
    monkeypatch.setattr(controller, f"make_{provider}_client", lambda: client)
    monkeypatch.setattr(service, "get_or_create_oauth_user", MagicMock(return_value=user))
    session = MagicMock()
    monkeypatch.setattr(service, "_build_token_response", session)
    response = asyncio.run(getattr(controller, f"{provider}_callback")("auth-code", request(), db))
    assert response.status_code == 307
    assert list(controller._oauth_token_store.values())[0]["user_id"] == user.id
    assert "access_token" not in list(controller._oauth_token_store.values())[0]
    session.assert_not_called()


def test_swagger_cannot_bypass_mfa(monkeypatch):
    user, db = user_and_db()
    monkeypatch.setattr(service, "authenticate_user", MagicMock(return_value=user))
    session = MagicMock()
    monkeypatch.setattr(service, "_build_token_response", session)
    with pytest.raises(HTTPException) as error:
        controller.swagger_login(request(), SimpleNamespace(username=user.email, password="test"), db)
    assert error.value.status_code == 403
    session.assert_not_called()


def test_password_login_requires_mfa_and_uses_account_email(monkeypatch):
    user, db = user_and_db()
    monkeypatch.setattr(service, "authenticate_user", MagicMock(return_value=user))
    send = MagicMock()
    monkeypatch.setattr(email_service, "send_otp_email", send)
    session = MagicMock()
    monkeypatch.setattr(service, "_build_token_response", session)
    result = controller.login(models.LoginRequest(email=user.email, password="test"), request(), db)
    assert result.mfa_required is True
    assert result.access_token is None
    assert send.call_args.args[0] == user.email
    session.assert_not_called()


def test_resend_uses_account_email(monkeypatch):
    user, db = user_and_db()
    send = MagicMock()
    monkeypatch.setattr(email_service, "send_otp_email", send)
    pending = service.build_mfa_pending_response(user)
    controller.resend_otp(models.ResendOTPRequest(mfa_token=pending.mfa_token), db)
    assert send.call_count == 2
    assert all(call.args[0] == user.email for call in send.call_args_list)


@pytest.mark.parametrize("correct", [True, False])
def test_full_tokens_only_after_correct_otp(monkeypatch, correct):
    user, db = user_and_db()
    monkeypatch.setattr(email_service, "send_otp_email", MagicMock())
    pending = service.build_mfa_pending_response(user)
    expected = service.otp_store[user.id]["otp"]
    session = MagicMock(return_value=models.TokenResponse(access_token="access", refresh_token="refresh"))
    monkeypatch.setattr(service, "_build_token_response", session)
    monkeypatch.setattr(controller, "create_notification", MagicMock())
    monkeypatch.setattr(service, "log_event", MagicMock())
    body = models.VerifyOTPRequest(mfa_token=pending.mfa_token, code=expected if correct else "000000")
    if correct:
        result = controller.verify_otp(body, request(), db)
        assert result.access_token == "access"
        assert user.id not in service.otp_store
    else:
        with pytest.raises(HTTPException):
            controller.verify_otp(body, request(), db)
        session.assert_not_called()

def test_microsoft_stays_disabled_until_verified_identity_flow_is_available():
    with pytest.raises(HTTPException) as error:
        asyncio.run(controller.microsoft_login())
    assert error.value.status_code == 503
