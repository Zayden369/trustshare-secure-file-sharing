"""Opt-in PostgreSQL checks; only a validated disposable schema is modified."""
import os
import uuid
import time
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException
from src.database.core import Base
from src.assistant import chat_service, config_service, conversation_service
from src.assistant.seed import seed_all_assistant_data
from src.entities.user import User
from src.entities.file import File
from src.entities.chat_turn import ChatTurn
from src.entities.chat_message import ChatMessage
from src.entities.file_summary import FileSummary
from src.entities.summary_job import SummaryJob, SummaryRevision
from src.file_summaries import service
from src.file_summaries.models import SummaryCreate
from src.file_summaries.providers import ExtractiveFallbackProvider

pytestmark=pytest.mark.skipif(os.getenv('RUN_TEST_AI_POSTGRES')!='1',reason='Opt-in isolated PostgreSQL checks')


@pytest.fixture
def store(monkeypatch):
    schema='ts_ai_test_'+uuid.uuid4().hex
    assert schema.startswith('ts_ai_test_') and schema.replace('_','').isalnum()
    url=os.environ['TEST_POSTGRES_URL']
    assert url.startswith('postgresql')
    admin=create_engine(url)
    with admin.begin() as connection:connection.execute(text('CREATE SCHEMA '+schema))
    engine=create_engine(url,connect_args={'options':'-csearch_path='+schema})
    Base.metadata.create_all(engine)
    factory=sessionmaker(bind=engine)
    with factory() as db:
        seed_all_assistant_data(db)
        config_service.set_value(db,'ENABLE_ASSISTANT',True)
        user=User(name='PostgreSQL synthetic user',email=uuid.uuid4().hex+'@example.com',hashed_password='unused')
        db.add(user);db.flush()
        file=File(owner_id=user.id,original_name='synthetic.txt',stored_name=uuid.uuid4().hex,mimetype='text/plain',size=200,encrypted=False,version=1,hash_sha256='a'*64)
        db.add(file);db.commit();ids=(user.id,file.id)
    monkeypatch.setattr(service,'SessionLocal',factory)
    monkeypatch.setenv('AI_SUMMARY_PROVIDER','extractive_fallback')
    config_service.clear_cache()
    yield factory,ids
    config_service.clear_cache();engine.dispose()
    with admin.begin() as connection:connection.execute(text('DROP SCHEMA '+schema+' CASCADE'))
    admin.dispose()


def race(factory,operation):
    barrier=Barrier(2)
    def run(_):
        with factory() as db:
            barrier.wait()
            try:operation(db);return 200
            except HTTPException as error:db.rollback();return error.status_code
    with ThreadPoolExecutor(max_workers=2) as pool:return sorted(pool.map(run,range(2)))


def test_only_one_request_can_claim_an_existing_conversation(store):
    factory,(user_id,file_id)=store
    with factory() as db:
        conv=conversation_service.create_conversation(db,user_id,'Concurrency test');conv_id=conv.id
    def claim(db):
        chat_service._prepare(db,db.get(User,user_id),'Explain a checksum.',conv_id,None,None,uuid.uuid4().hex)
    assert race(factory,claim)==[200,409]
    with factory() as db:
        assert db.query(ChatTurn).filter_by(conversation_id=conv_id,status='processing').count()==1
        assert db.query(ChatMessage).filter_by(conversation_id=conv_id,role='user').count()==1


def test_identical_request_id_is_reserved_once(store):
    factory,(user_id,file_id)=store;request=uuid.uuid4().hex
    def claim(db):chat_service._prepare(db,db.get(User,user_id),'Explain a checksum.',None,None,None,request)
    assert race(factory,claim)==[200,409]
    with factory() as db:
        assert db.query(ChatTurn).count()==1
        assert db.query(ChatMessage).filter_by(role='user').count()==1


def test_concurrent_summary_creation_produces_one_job(store):
    factory,(user_id,file_id)=store
    assert race(factory,lambda db:service.create_summary(db,file_id,user_id,SummaryCreate()))==[200,409]
    with factory() as db:
        assert db.query(FileSummary).count()==1 and db.query(SummaryJob).count()==1


def test_concurrent_forced_regeneration_has_one_snapshot_and_generation(store):
    factory,(user_id,file_id)=store
    with factory() as db:
        summary,_=service.create_summary(db,file_id,user_id,SummaryCreate())
        summary.status='completed';summary.summary_text='Original synthetic summary';db.get(SummaryJob,summary.id).phase='completed';db.commit()
    operation=lambda db:service.create_summary(db,file_id,user_id,SummaryCreate(force_regenerate=True))
    assert race(factory,operation)==[200,409]
    with factory() as db:
        assert db.query(SummaryRevision).count()==1
        assert db.query(FileSummary).one().status=='pending'


def test_duplicate_workers_execute_provider_once(store,monkeypatch):
    factory,(user_id,file_id)=store
    with factory() as db:summary,_=service.create_summary(db,file_id,user_id,SummaryCreate());summary_id=summary.id
    monkeypatch.setattr(service,'_load_plaintext',lambda _:b'Synthetic files are encrypted before storage. Owners control authorized reviewer permissions.')
    calls=[]
    def generate(text,options,fallback_text=None):
        calls.append(1);time.sleep(0.08);provider=ExtractiveFallbackProvider()
        return provider.generate_summary(text,options),provider,None
    monkeypatch.setattr(service,'_run_provider',generate)
    barrier=Barrier(2)
    def run(_):barrier.wait();service.process_summary(summary_id)
    with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(run,range(2)))
    with factory() as db:assert db.get(FileSummary,summary_id).status=='completed'
    assert len(calls)==1


def test_concurrent_retry_claims_failed_turn_once(store):
    factory,(user_id,_)=store;request=uuid.uuid4().hex
    with factory() as db:
        turn,*_=chat_service._prepare(db,db.get(User,user_id),'Explain a checksum.',None,None,None,request)
        turn.status='failed';db.commit()
    assert race(factory,lambda db:chat_service._prepare(db,db.get(User,user_id),'Explain a checksum.',None,None,None,request))==[200,409]
    with factory() as db:
        assert db.query(ChatMessage).filter_by(role='user').count()==1


def test_explain_owner_filter_sort_and_grouping_on_synthetic_rows(store):
    import json
    factory,(user_id,_)=store
    with factory() as db:
        db.bulk_insert_mappings(File,[{'owner_id':user_id,'original_name':f'synthetic-{i}.txt','stored_name':uuid.uuid4().hex,'mimetype':'text/plain','size':i,'encrypted':True,'version':1,'is_deleted':False} for i in range(2000)])
        db.commit()
        queries={
            'largest':'SELECT id,size FROM files WHERE owner_id=:owner AND is_deleted=false ORDER BY size DESC,id DESC LIMIT 10',
            'recent':'SELECT id FROM files WHERE owner_id=:owner AND is_deleted=false ORDER BY created_at DESC,id DESC LIMIT 10',
            'grouped_storage':'SELECT mimetype,count(*),sum(size) FROM files WHERE owner_id=:owner AND is_deleted=false GROUP BY mimetype'}
        plans={name:db.execute(text('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql),{'owner':user_id}).scalar() for name,sql in queries.items()}
        assert all(value[0]['Execution Time']<1000 for value in plans.values())
        output=os.getenv('AI_QUERY_PLAN_OUTPUT')
        if output:
            assert output.startswith('/tmp/')
            from pathlib import Path
            Path(output).write_text(json.dumps(plans,indent=2),encoding='utf-8')
