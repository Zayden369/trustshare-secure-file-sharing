"""Persistent, purpose-bound registration verification. No development OTP bypass."""
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from email_validator import validate_email, EmailNotValidError
from fastapi import HTTPException
from sqlalchemy import Column, String, Integer, DateTime, Boolean, ForeignKey, update, func
from sqlalchemy.exc import IntegrityError
from src.database.core import Base
from src.entities.user import User
from src.auth import email_service

class RegistrationChallenge(Base):
    __tablename__ = 'registration_challenges'
    id = Column(String(80), primary_key=True)
    email = Column(String(254), index=True, nullable=False)
    digest = Column(String(64), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    otp_used = Column(Boolean, default=False, nullable=False)
    proof = Column(String(64), unique=True, nullable=True)
    proof_expires = Column(DateTime(timezone=True), nullable=True)
    used = Column(Boolean, default=False, nullable=False)

class RegistrationLimit(Base):
    __tablename__ = 'registration_limits'
    key = Column(String(64), primary_key=True)
    started = Column(DateTime(timezone=True), nullable=False)
    sends = Column(Integer, default=0, nullable=False)
    failures = Column(Integer, default=0, nullable=False)
    next_send = Column(DateTime(timezone=True), nullable=False)
    delivery_id = Column(String(80), nullable=True)

class VerifiedEmail(Base):
    __tablename__ = 'verified_emails'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    email = Column(String(254), nullable=False)
    method = Column(String(30), nullable=False)
    verified_at = Column(DateTime(timezone=True), nullable=False)

def now(): return datetime.now(timezone.utc)
def aware(value): return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
def key(value): return hashlib.sha256(value.encode()).hexdigest()
def digest(challenge, email, code):
    secret = os.getenv('OTP_SIGNING_SECRET') or os.getenv('SECRET_KEY')
    if not secret or len(secret) < 32:
        raise HTTPException(503, 'Email verification is not configured. Please contact support.')
    return hmac.new(secret.encode(), ('registration\0'+challenge+'\0'+email+'\0'+code).encode(), hashlib.sha256).hexdigest()

def normalize(email, delivery=False):
    if not isinstance(email, str) or len(email) > 254:
        raise HTTPException(422, 'Please enter a valid email address.')
    try:
        # Temporary DNS failures are represented as unknown deliverability by the library.
        return validate_email(email.strip(), check_deliverability=delivery, timeout=4).normalized.lower()
    except EmailNotValidError:
        raise HTTPException(422, 'Please check your email address and email domain.') from None

def limit(db, label):
    identifier=key(label)
    row=db.query(RegistrationLimit).filter_by(key=identifier).with_for_update().first()
    if row is None:
        try:
            with db.begin_nested():
                db.add(RegistrationLimit(key=identifier, started=now(), next_send=now(), sends=0, failures=0))
                db.flush()
        except IntegrityError: pass
        row=db.query(RegistrationLimit).filter_by(key=identifier).with_for_update().one()
    if aware(row.started)+timedelta(hours=1) <= now():
        row.started=now();row.sends=0;row.failures=0;row.next_send=now()
    return row

def send_code(db, email, ip):
    requests=limit(db,"request-ip:"+(ip or "unknown"))
    requests.sends+=1
    if requests.sends>60:
        db.commit();raise HTTPException(429,"Too many requests. Please try again later.",headers={"Retry-After":"3600"})
    db.commit()
    email=normalize(email, delivery=True)
    db.query(RegistrationChallenge).filter(RegistrationChallenge.expires_at < now()-timedelta(days=1)).delete(synchronize_session=False)
    db.commit()  # Retention cleanup never holds challenge locks while taking email locks.
    if db.query(User).filter(func.lower(User.email)==email).first():
        raise HTTPException(409, 'This address cannot be registered. Try signing in or recovering your account.')
    # Fixed lock order prevents mail/IP lock inversion.
    rows={label:limit(db,label) for label in sorted(['email:'+email, 'ip:'+(ip or 'unknown')])}
    mail=rows['email:'+email]; network=rows['ip:'+(ip or 'unknown')]
    if mail.sends>=5 or network.sends>=20 or mail.failures>=10 or aware(mail.next_send)>now():
        db.rollback();raise HTTPException(429, 'Please wait before requesting another code.', headers={'Retry-After':'60'})
    identifier=secrets.token_urlsafe(32);code=f'{secrets.randbelow(1000000):06d}'
    hashed=digest(identifier,email,code)
    mail.sends+=1;network.sends+=1;mail.next_send=now()+timedelta(seconds=60);mail.delivery_id=identifier
    db.commit()  # Reserve delivery budget before contacting SMTP, including on failure.
    try: email_service.send_registration_email(email,code)
    except email_service.EmailDeliveryError:
        raise HTTPException(503, 'We could not send the verification email. Please try again later.') from None
    latest=limit(db,'email:'+email)
    if latest.delivery_id != identifier:
        db.rollback();raise HTTPException(409,'A newer verification code was requested.')
    db.query(RegistrationChallenge).filter_by(email=email).update({'used':True,'otp_used':True})
    db.add(RegistrationChallenge(id=identifier,email=email,digest=hashed,expires_at=now()+timedelta(minutes=5)))
    db.commit()
    return {'challenge_id':identifier,'expires_in':300,'resend_after':60}

def verify_code(db, challenge_id, code, ip="unknown"):
    network=limit(db, "verify-ip:"+(ip or "unknown"))
    network.sends+=1
    if network.sends>60:
        db.commit();raise HTTPException(429,"Too many verification attempts. Please try again later.")
    db.commit()
    candidate=db.query(RegistrationChallenge).filter_by(id=challenge_id).first()
    if not candidate:
        raise HTTPException(400,'This code is unavailable or expired. Request a new code.')
    rate=limit(db,'email:'+candidate.email)
    challenge=db.query(RegistrationChallenge).filter_by(id=challenge_id).with_for_update().populate_existing().first()
    if not challenge or challenge.used or challenge.otp_used or aware(challenge.expires_at)<=now() or challenge.attempts>=5:
        raise HTTPException(400,'This code is unavailable or expired. Request a new code.')
    if rate.failures>=10:
        db.rollback();raise HTTPException(429,'Too many incorrect codes. Please try again later.')
    if not isinstance(code,str) or len(code)!=6 or not code.isascii() or not code.isdigit() or not hmac.compare_digest(challenge.digest,digest(challenge.id,challenge.email,code)):
        challenge.attempts+=1;rate.failures+=1;db.commit()
        raise HTTPException(400,'Incorrect verification code.')
    proof=secrets.token_urlsafe(32)
    challenge.otp_used=True;challenge.digest='';challenge.proof=key(proof);challenge.proof_expires=now()+timedelta(minutes=5)
    db.commit()
    return {'verification_token':proof,'email':challenge.email,'expires_in':300}

def consume(db, email, proof):
    if not proof or len(proof)>200:
        raise HTTPException(403,'Verify your email before creating an account.')
    changed=db.execute(update(RegistrationChallenge).where(RegistrationChallenge.email==email,RegistrationChallenge.proof==key(proof),RegistrationChallenge.otp_used==True,RegistrationChallenge.used==False,RegistrationChallenge.proof_expires>now()).values(used=True))
    if changed.rowcount != 1:
        db.rollback();raise HTTPException(403,'Email verification has expired or does not match this address.')
