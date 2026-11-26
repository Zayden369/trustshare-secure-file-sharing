"""Opt-in real row-lock tests, isolated in a disposable PostgreSQL schema.

RUN_TEST_POSTGRES=1 python -m pytest tests/test_registration_concurrency_postgres.py
Uses DATABASE_URL; never queries application tables in the public schema.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from src.database import init_db
from src.database.core import Base
from src.auth import registration as r, service, controller, models
from src.entities.user import User

pytestmark=pytest.mark.skipif(os.getenv('RUN_TEST_POSTGRES')!='1',reason='Opt-in isolated PostgreSQL concurrency check')

@pytest.fixture
def store(monkeypatch):
    schema='ts_verification_test_'+uuid.uuid4().hex
    assert schema.startswith('ts_verification_test_') and schema.replace('_','').isalnum()
    url=os.environ['DATABASE_URL']
    admin=create_engine(url)
    with admin.begin() as conn:conn.execute(text('CREATE SCHEMA '+schema))
    engine=create_engine(url,connect_args={'options':'-csearch_path='+schema})
    Base.metadata.create_all(engine)
    factory=sessionmaker(bind=engine)
    delivered=[]
    normalize=r.normalize
    monkeypatch.setattr(r,'normalize',lambda email,delivery=False:normalize(email,False))
    monkeypatch.setattr(r.email_service,'send_registration_email',lambda email,code:delivered.append(code))
    monkeypatch.setattr(service,'log_event',lambda *a,**kw:None)
    monkeypatch.setenv('OTP_SIGNING_SECRET','isolated-test-signing-key-'+uuid.uuid4().hex)
    yield factory,delivered
    engine.dispose()
    # The generated identifier is validated above; only this test's schema is removed.
    with admin.begin() as conn:conn.execute(text('DROP SCHEMA '+schema+' CASCADE'))
    admin.dispose()

def race(factory,fn):
    barrier=Barrier(2)
    def run():
        with factory() as db:
            barrier.wait()
            try:fn(db);return 200
            except HTTPException as error:db.rollback();return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:return sorted(pool.map(lambda _:run(),range(2)))

def verified(store):
    factory,delivered=store
    with factory() as db:
        code=r.send_code(db,'concurrency@gmail.com','192.0.2.10')
        proof=r.verify_code(db,code['challenge_id'],delivered[-1])['verification_token']
    return proof

def test_concurrent_signup_consumes_proof_exactly_once(store):
    factory,_=store;proof=verified(store)
    data=models.SignupRequest(name='Controlled concurrency',email='concurrency@gmail.com',password='StrongPassword12!',verification_token=proof)
    assert race(factory,lambda db:service.register_user(db,data))==[200,403]
    with factory() as db:
        assert db.query(User).count()==1
        assert db.query(r.VerifiedEmail).count()==1

def test_proof_consumption_rolls_back_with_failed_account_transaction(store):
    factory,_=store;proof=verified(store)
    with factory() as db:
        r.consume(db,'concurrency@gmail.com',proof);db.rollback()
    with factory() as db:
        r.consume(db,'concurrency@gmail.com',proof);db.commit()

def test_concurrent_correct_codes_issue_only_one_proof(store):
    factory,delivered=store
    with factory() as db:challenge=r.send_code(db,'concurrency@gmail.com','192.0.2.10')['challenge_id']
    assert race(factory,lambda db:r.verify_code(db,challenge,delivered[-1]))==[200,400]

def test_concurrent_refresh_rotates_only_once(store):
    factory,_=store
    request=SimpleNamespace(headers={'user-agent':'Test browser'},client=SimpleNamespace(host='192.0.2.10'))
    with factory() as db:
        account=User(name='Refresh race',email='refresh@gmail.com',hashed_password='unused');db.add(account);db.commit()
        tokens=service._build_token_response(account,db,request)
    body=models.RefreshRequest(refresh_token=tokens.refresh_token)
    assert race(factory,lambda db:controller.refresh(body,request,db))==[200,401]
