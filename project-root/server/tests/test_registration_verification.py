from datetime import timedelta
from types import SimpleNamespace
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.database import init_db
from src.database.core import Base, get_db
from src.auth import registration as r, service, controller, models, dependencies
from src.entities.user import User
from src.entities.login_session import LoginSession

real_registration_email = r.email_service.send_registration_email
real_normalize = r.normalize

@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv('OTP_SIGNING_SECRET', 'test-secret-for-isolated-verification-'*2)
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db=sessionmaker(bind=engine)()
    delivered=[]
    real_normalize=r.normalize
    monkeypatch.setattr(r,'normalize',lambda email,delivery=False:real_normalize(email,False))
    monkeypatch.setattr(r.email_service,'send_registration_email',lambda email,code:delivered.append((email,code)))
    monkeypatch.setattr(service,'log_event',lambda *a,**kw:None)
    monkeypatch.setattr(controller,'create_notification',lambda *a,**kw:None)
    yield db,delivered
    db.close();engine.dispose()

def challenge(env,email='owned+tag@gmail.com',ip='192.0.2.10'):
    db,delivered=env
    result=r.send_code(db,email,ip)
    return result['challenge_id'],delivered[-1][1]

def proof(env,email='owned+tag@gmail.com'):
    identifier,code=challenge(env,email)
    return r.verify_code(env[0],identifier,code)['verification_token']

def reject(status,fn):
    with pytest.raises(HTTPException) as error:fn()
    assert error.value.status_code==status

def test_verified_registration_consumes_proof_and_records_evidence(env):
    db,delivered=env; token=proof(env)
    result=service.register_user(db,models.SignupRequest(name='Controlled account',email='owned+tag@gmail.com',password='StrongPassword12!',verification_token=token))
    assert result.user.email=='owned+tag@gmail.com'
    assert db.get(r.VerifiedEmail,result.user.id).method=='registration_otp'
    reject(403,lambda:r.consume(db,'owned+tag@gmail.com',token))
    assert db.query(User).count()==1

def test_unverified_direct_signup_cannot_create_account(env):
    db,_=env
    reject(403,lambda:service.register_user(db,models.SignupRequest(name='Bypass',email='bypass@gmail.com',password='StrongPassword12!')))
    assert db.query(User).count()==0

def test_no_plaintext_code_or_proof_is_stored_or_returned(env,capsys):
    db,_=env;identifier,code=challenge(env)
    row=db.get(r.RegistrationChallenge,identifier)
    assert row.digest!=code and len(row.digest)==64
    answer=r.verify_code(db,identifier,code)
    assert 'code' not in answer and 'otp' not in answer
    db.refresh(row);assert row.digest=='' and row.proof!=answer['verification_token']
    assert code not in capsys.readouterr().out

@pytest.mark.parametrize('code',['111111','12345x','１２３４５６'])
def test_wrong_or_malformed_code_rejected(env,code):
    identifier,_=challenge(env);reject(400,lambda:r.verify_code(env[0],identifier,code))

def test_attempt_budget_and_single_use_otp(env):
    db,_=env;identifier,code=challenge(env)
    wrong='000001' if code!='000001' else '000002'
    for _ in range(5):reject(400,lambda:r.verify_code(db,identifier,wrong))
    reject(400,lambda:r.verify_code(db,identifier,code))

def test_correct_code_cannot_be_replayed(env):
    identifier,code=challenge(env);r.verify_code(env[0],identifier,code)
    reject(400,lambda:r.verify_code(env[0],identifier,code))

def test_challenge_and_proof_expire(env,monkeypatch):
    db,_=env;identifier,code=challenge(env);later=r.now()+timedelta(minutes=6)
    monkeypatch.setattr(r,'now',lambda:later)
    reject(400,lambda:r.verify_code(db,identifier,code))

def test_proof_expiry_and_email_binding(env,monkeypatch):
    db,_=env;token=proof(env)
    reject(403,lambda:r.consume(db,'different@gmail.com',token))
    later=r.now()+timedelta(minutes=6);monkeypatch.setattr(r,'now',lambda:later)
    reject(403,lambda:r.consume(db,'owned+tag@gmail.com',token))

def test_cooldown_and_resend_invalidates_old_challenge_and_proof(env,monkeypatch):
    db,_=env;identifier,code=challenge(env);token=r.verify_code(db,identifier,code)['verification_token']
    reject(429,lambda:r.send_code(db,'owned+tag@gmail.com','192.0.2.10'))
    later=r.now()+timedelta(seconds=61);monkeypatch.setattr(r,'now',lambda:later)
    second,newcode=challenge(env)
    reject(400,lambda:r.verify_code(db,identifier,code));reject(403,lambda:r.consume(db,'owned+tag@gmail.com',token))
    assert r.verify_code(db,second,newcode)['verification_token']

def test_persistent_email_and_ip_send_limits(env,monkeypatch):
    db,_=env
    for i in range(20):challenge(env,email=f'user{i}@gmail.com')
    reject(429,lambda:challenge(env,email='user21@gmail.com'))
    assert db.query(r.RegistrationLimit).filter_by(key=r.key('ip:192.0.2.10')).one().sends==20

def test_verification_ip_budget(env):
    db,_=env;identifier,code=challenge(env)
    for _ in range(60):reject(400,lambda:r.verify_code(db,'not-a-challenge',code,'192.0.2.22'))
    reject(429,lambda:r.verify_code(db,identifier,code,'192.0.2.22'))

def test_smtp_failure_fails_closed_and_consumes_delivery_budget(env,monkeypatch):
    db,_=env
    def fail(*a):raise r.email_service.EmailDeliveryError('smtp_unavailable')
    monkeypatch.setattr(r.email_service,'send_registration_email',fail)
    reject(503,lambda:r.send_code(db,'owned@gmail.com','192.0.2.1'))
    assert db.query(r.RegistrationChallenge).count()==0
    reject(429,lambda:r.send_code(db,'owned@gmail.com','192.0.2.1'))

def test_missing_signing_secret_fails_closed(env,monkeypatch):
    monkeypatch.delenv('OTP_SIGNING_SECRET',raising=False);monkeypatch.delenv('SECRET_KEY',raising=False)
    reject(503,lambda:challenge(env));assert env[1]==[]

@pytest.mark.parametrize('email',['first.last+tag@gmail.com','worker@company.co.in','person@outlook.com'])
def test_maintained_syntax_validation_accepts_valid_variations(env,email):
    assert r.normalize(email)==email

@pytest.mark.parametrize('email',['missing-at','user@','a b@gmail.com','a@gmail.com\nBcc: bad@gmail.com'])
def test_invalid_syntax_rejected(env,email):reject(422,lambda:r.normalize(email))

@pytest.mark.parametrize("environment",["development","production"])
def test_smtp_is_required_in_every_environment(env,monkeypatch,capsys,environment):
    monkeypatch.setenv('ENVIRONMENT',environment);monkeypatch.setattr(r.email_service,'SMTP_USER','')
    with pytest.raises(r.email_service.EmailDeliveryError):real_registration_email('owned@gmail.com','123456')
    assert '123456' not in capsys.readouterr().out

def request():return SimpleNamespace(headers={'user-agent':'Test browser'},client=SimpleNamespace(host='192.0.2.1'))

def user(db,mfa=False):
    row=User(name='Session test',email='session@gmail.com',hashed_password=dependencies.hash_password('TestPassword12!'),mfa_enabled=mfa)
    db.add(row);db.commit();return row

def test_access_requires_current_server_session_and_logout_revokes(env):
    db,_=env;account=user(db);tokens=service._build_token_response(account,db,request())
    assert dependencies.get_current_user(tokens.access_token,db).id==account.id
    controller.logout(account,db)
    reject(401,lambda:dependencies.get_current_user(tokens.access_token,db))
    reject(401,lambda:controller.refresh(models.RefreshRequest(refresh_token=tokens.refresh_token),request(),db))

def test_refresh_rotation_rejects_reuse_and_old_access(env):
    db,_=env;account=user(db);old=service._build_token_response(account,db,request())
    new=controller.refresh(models.RefreshRequest(refresh_token=old.refresh_token),request(),db)
    assert new.access_token!=old.access_token
    reject(401,lambda:dependencies.get_current_user(old.access_token,db))
    reject(401,lambda:controller.refresh(models.RefreshRequest(refresh_token=old.refresh_token),request(),db))
    assert dependencies.get_current_user(new.access_token,db).id==account.id

def test_legacy_access_requires_refresh_but_existing_refresh_upgrades(env):
    db,_=env;account=user(db)
    refresh=dependencies.create_refresh_token({'sub':str(account.id)})
    db.add(LoginSession(user_id=account.id,refresh_token=refresh,is_current=True));db.commit()
    reject(401,lambda:dependencies.get_current_user(dependencies.create_access_token({'sub':str(account.id)}),db))
    upgraded=controller.refresh(models.RefreshRequest(refresh_token=refresh),request(),db)
    assert dependencies.get_current_user(upgraded.access_token,db).id==account.id

def test_invalid_expired_and_mfa_tokens_cannot_open_dashboard(env):
    db,_=env;account=user(db)
    for token in ['invalid',dependencies.create_access_token({'sub':str(account.id)},timedelta(seconds=-1)),dependencies.create_access_token({'sub':str(account.id),'type':'mfa_pending'})]:
        reject(401,lambda:dependencies.get_current_user(token,db))

def test_password_and_oauth_login_require_mfa_before_session(env,monkeypatch):
    db,_=env;account=user(db,True);sent=[]
    monkeypatch.setattr(service.email_service,'send_otp_email',lambda email,code,name:sent.append(code))
    monkeypatch.setattr(service,'authenticate_user',lambda *a,**kw:account)
    pending=controller.login(models.LoginRequest(email=account.email,password='TestPassword12!'),request(),db)
    assert pending.mfa_required and not pending.access_token and db.query(LoginSession).count()==0
    code=controller._store_oauth_user(account.id)
    oauth=controller.oauth_exchange(models.OAuthExchangeRequest(code=code),request(),db)
    assert oauth['mfa_required'] and not oauth['access_token'] and db.query(LoginSession).count()==0
    reject(400,lambda:controller.oauth_exchange(models.OAuthExchangeRequest(code=code),request(),db))
    verified=controller.verify_otp(models.VerifyOTPRequest(mfa_token=oauth['mfa_token'],code=sent[-1]),request(),db)
    assert dependencies.get_current_user(verified.access_token,db).id==account.id

def test_api_rejects_unverified_signup_and_forged_proof(env):
    db,_=env;app=FastAPI();app.include_router(controller.router,prefix='/api/auth');app.dependency_overrides[get_db]=lambda:db
    with TestClient(app) as client:
        for extra in [{},{'verification_token':'invented-proof'}]:
            response=client.post('/api/auth/signup',json={'name':'Bypass','email':'bypass@gmail.com','password':'StrongPassword12!',**extra})
            assert response.status_code==403
    assert db.query(User).count()==0

def test_dns_unknown_is_allowed_but_nonexistent_domains_rejected(monkeypatch):
    import dns.resolver
    import dns.exception
    def nonexistent(*a,**kw):raise dns.resolver.NXDOMAIN()
    monkeypatch.setattr(dns.resolver.Resolver,'resolve',nonexistent)
    reject(422,lambda:real_normalize('user@missing-domain-87423.com',True))
    def timeout(*a,**kw):raise dns.exception.Timeout()
    monkeypatch.setattr(dns.resolver.Resolver,'resolve',timeout)
    assert real_normalize('user@temporary-domain.com',True)=='user@temporary-domain.com'

def test_google_requires_browser_state_and_verified_provider_claim(env,monkeypatch):
    import asyncio
    from starlette.requests import Request
    db,_=env
    def req(state=True):
        return Request({'type':'http','method':'GET','scheme':'http','server':('localhost',8000),'path':'/api/auth/oauth/google/callback','query_string':b'state=browser-state' if state else b'','headers':[(b'cookie',b'trustshare_google_state=browser-state')],'client':('192.0.2.1',3000)})
    reject(400,lambda:asyncio.run(controller.google_callback('code',req(False),db)))
    profile={'email':'trusted@gmail.com','name':'Trusted','email_verified':False}
    class Client:
        async def fetch_token(self,*a,**kw):return {}
        async def get(self,*a,**kw):return SimpleNamespace(json=lambda:profile)
    monkeypatch.setattr(controller,'make_google_client',lambda:Client())
    reject(400,lambda:asyncio.run(controller.google_callback('code',req(),db)))
    assert db.query(User).count()==0
    profile['email_verified']=True
    result=asyncio.run(controller.google_callback('code',req(),db))
    assert result.status_code==307
    assert db.query(r.VerifiedEmail).one().method=='google_verified'
    assert db.query(LoginSession).count()==0

def test_dns_null_mx_rejected_and_working_corporate_mx_accepted(monkeypatch):
    import dns.resolver
    monkeypatch.setattr(dns.resolver.Resolver,'resolve',lambda *a,**kw:[SimpleNamespace(preference=0,exchange='.')])
    reject(422,lambda:real_normalize('user@no-mail-corporate.net',True))
    monkeypatch.setattr(dns.resolver.Resolver,'resolve',lambda *a,**kw:[SimpleNamespace(preference=10,exchange='mx.mail-corporate.net.')])
    assert real_normalize('employee+project@mail-corporate.net',True)=='employee+project@mail-corporate.net'

def test_challenge_persists_across_database_sessions(env):
    from sqlalchemy.orm import Session
    db,_=env;identifier,code=challenge(env)
    with Session(db.get_bind()) as another:
        assert r.verify_code(another,identifier,code)['verification_token']

@pytest.mark.parametrize('role',['member','admin'])
def test_role_boundaries_and_suspension_apply_to_session_bound_tokens(env,role):
    db,_=env;account=user(db);account.role=role;db.commit()
    tokens=service._build_token_response(account,db,request())
    current=dependencies.get_current_user(tokens.access_token,db)
    if role=='admin':assert dependencies.require_admin(current).id==account.id
    else:reject(403,lambda:dependencies.require_admin(current))
    account.is_active=False;db.commit()
    reject(401,lambda:dependencies.get_current_user(tokens.access_token,db))
