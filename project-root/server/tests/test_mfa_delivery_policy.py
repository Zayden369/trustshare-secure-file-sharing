"""MFA delivery must fail closed in every environment; never print OTPs."""
import pytest
from fastapi import HTTPException
from src.auth import service, email_service

@pytest.fixture(autouse=True)
def clear_store():
    service.otp_store.clear()
    yield
    service.otp_store.clear()

@pytest.mark.parametrize("environment",["development","production"])
@pytest.mark.parametrize("email",["test@example.com","recipient@gmail.com"])
def test_every_address_requires_smtp_without_logging_codes(monkeypatch,capsys,environment,email):
    monkeypatch.setenv("ENVIRONMENT",environment)
    sent=[]
    monkeypatch.setattr(email_service,"send_otp_email",lambda *args:sent.append(args))
    code=service.generate_otp(1,email,"Test")
    assert sent==[(email,code,"Test")]
    assert code not in capsys.readouterr().out
    assert service.verify_otp_code(1,code)
    assert not service.verify_otp_code(1,code)

@pytest.mark.parametrize("environment",["development","production"])
def test_smtp_failure_never_leaves_a_usable_code(monkeypatch,environment):
    monkeypatch.setenv("ENVIRONMENT",environment)
    def fail(*args):raise email_service.EmailDeliveryError("smtp_unavailable")
    monkeypatch.setattr(email_service,"send_otp_email",fail)
    with pytest.raises(HTTPException) as error:service.generate_otp(1,"recipient@gmail.com")
    assert error.value.status_code==503
    assert 1 not in service.otp_store

def test_mfa_attempts_are_limited(monkeypatch):
    monkeypatch.setattr(email_service,"send_otp_email",lambda *args:None)
    code=service.generate_otp(1,"recipient@gmail.com")
    wrong="000001" if code!="000001" else "000002"
    for _ in range(5):assert not service.verify_otp_code(1,wrong)
    assert not service.verify_otp_code(1,code)

def test_malformed_mfa_code_is_rejected_safely(monkeypatch):
    monkeypatch.setattr(email_service,"send_otp_email",lambda *args:None)
    service.generate_otp(1,"recipient@gmail.com")
    assert not service.verify_otp_code(1,"１２３４５６")
