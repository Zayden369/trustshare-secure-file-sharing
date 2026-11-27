import asyncio
import uuid
from datetime import datetime, timedelta, timezone
import pytest
from src.assistant import chat_service, config_service, functions, intents, conversation_service
from src.assistant.seed.seed_functions import seed_functions
from src.entities.user import User
from src.entities.file import File
from src.entities.assistant_function import AssistantFunction
from src.entities.assistant_suggested_query import AssistantSuggestedQuery
from src.entities.chat_turn import ChatTurn
from src.entities.chat_message import ChatMessage
from src.entities.login_session import LoginSession
from src.auth.dependencies import create_refresh_token


@pytest.fixture
def actor(db,monkeypatch):
    user=User(name='Synthetic AI user',email=uuid.uuid4().hex+'@example.test',hashed_password='unused',role='member')
    db.add(user);db.commit();seed_functions(db)
    monkeypatch.setattr(config_service,'get_bool',lambda db,key,default=False: key=='ENABLE_ASSISTANT' or default)
    original=config_service.get_int
    monkeypatch.setattr(config_service,'get_int',lambda db,key,default=0: {'MAX_MESSAGE_LENGTH':2000,'DEFAULT_FUNCTION_LIMIT':10,'MAX_FUNCTION_LIMIT':50}.get(key,default))
    return user


def forbid_llm(*args,**kwargs):
    raise AssertionError('Deterministic routes must not initialize or call an LLM')


@pytest.mark.parametrize('intent',intents.INTENTS,ids=lambda intent:intent.id)
def test_every_predefined_query_is_authorized_live_data_without_llm(db,actor,monkeypatch,intent):
    monkeypatch.setattr(chat_service,'LLMClient',forbid_llm)
    result=chat_service.process_chat(db,actor,intent.aliases[0],intent_id=intent.id,request_id=uuid.uuid4().hex)
    assert not result.get('error'),result
    assert result['route']=='deterministic'
    assert result['function_calls'][0]['name']==intent.operation
    assert result['performance']['counters']['llm_calls']==0
    conv=conversation_service.get_conversation(db,result['conversation_id'],actor.id)
    assert conv.title==intent.title
    assert [m.role for m in conversation_service.get_messages(db,conv.id)]==['user','function','assistant']


def file(db,owner,name,size=1,created=None,mimetype='application/pdf'):
    row=File(owner_id=owner.id,original_name=name,stored_name=uuid.uuid4().hex,size=size,encrypted=True,mimetype=mimetype,created_at=created or datetime.now(timezone.utc))
    db.add(row);db.commit();return row


def test_largest_files_and_calendar_month_are_sql_scoped(db,actor):
    other=User(name='Other',email=uuid.uuid4().hex+'@test.com',hashed_password='unused');db.add(other);db.commit()
    now=datetime.now(timezone.utc);start=now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
    file(db,actor,'old.pdf',900,start-timedelta(seconds=1))
    large=file(db,actor,'large.pdf',700,now)
    file(db,actor,'small.pdf',3,now)
    file(db,actor,'text.txt',999,now,'text/plain')
    file(db,other,'private.pdf',9999,now)
    rows=functions.execute_function('list_files',{'sort_by':'size'},db,actor)['files']
    assert [r['name'] for r in rows]==['text.txt','old.pdf','large.pdf','small.pdf']
    result=functions.execute_function('list_files',{'file_type':'pdf','calendar_month':True},db,actor)
    assert result['total_matched']==2 and large.id in [r['id'] for r in result['files']]
    assert 'old.pdf' not in [r['name'] for r in result['files']]


def test_intent_spoofing_and_unknown_arguments_are_rejected(db,actor,monkeypatch):
    monkeypatch.setattr(chat_service,'LLMClient',forbid_llm)
    result=chat_service.process_chat(db,actor,'Show my active login sessions',intent_id='account.profile')
    assert result['error'] and result['status_code']==400
    result=functions.execute_function('list_files',{'user_id':99999},db,actor)
    assert result['error']
    assert functions.execute_function('delete_file',{},db,actor)['error']


def test_dynamic_suggestion_alias_is_validated_and_ambiguous_text_uses_ai(db,actor):
    row=AssistantSuggestedQuery(query_text='My recent files',category='files',is_active=True)
    db.add(row);db.commit()
    assert intents.resolve(db,row.query_text,suggestion_id=row.id).id=='files.recent'
    assert intents.resolve(db,'Show my recent files and explain the risks') is None
    assert intents.resolve(db,'Do not show my recent files') is None
    with pytest.raises(Exception):
        intents.resolve(db,'Show my active sessions',suggestion_id=row.id)


def test_admin_curated_custom_suggestion_has_a_stable_safe_intent(db,actor,monkeypatch):
    from src.entities.assistant_suggested_query import AssistantSuggestionIntent
    row=AssistantSuggestedQuery(query_text='My remaining workspace capacity',category='storage',is_active=True)
    db.add(row);db.flush();db.add(AssistantSuggestionIntent(suggestion_id=row.id,intent_id='storage.overview'));db.commit()
    monkeypatch.setattr(chat_service,'LLMClient',forbid_llm)
    result=chat_service.process_chat(db,actor,row.query_text,intent_id='storage.overview',suggestion_id=row.id)
    assert result['route']=='deterministic'
    assert result['function_calls'][0]['name']=='get_storage_info'
    assert intents.resolve(db,row.query_text).id=='storage.overview'


def test_permissions_and_feature_flags_apply_to_fast_path(db,actor,monkeypatch):
    row=db.query(AssistantFunction).filter_by(function_name='get_storage_info').one()
    row.requires_admin=True;db.commit()
    assert functions.execute_function('get_storage_info',{},db,actor)['error']
    row.requires_admin=False;db.commit()
    monkeypatch.setattr(config_service,'get_bool',lambda *args:False)
    assert chat_service.process_chat(db,actor,'Show my recent files')['error']


def test_active_sessions_exclude_history_invalid_and_other_accounts(db,actor):
    for current,token in [(False,create_refresh_token({'sub':str(actor.id)})),(True,'invalid'),(True,create_refresh_token({'sub':str(actor.id)}))]:
        db.add(LoginSession(user_id=actor.id,is_current=current,refresh_token=token))
    db.commit()
    result=functions.execute_function('list_active_sessions',{},db,actor)
    assert result['total_sessions']==1
    assert all('refresh_token' not in row for row in result['sessions'])


def test_knowledge_uses_real_limit_and_correct_encryption_terminology(db,actor,monkeypatch):
    monkeypatch.setattr(chat_service,'LLMClient',forbid_llm)
    result=chat_service.process_chat(db,actor,'How many files can I upload at once?')
    assert result['route']=='knowledge' and 'no implemented five-file' in result['message']
    result=chat_service.process_chat(db,actor,'Is TrustShare end-to-end encrypted?')
    assert 'not end-to-end' in result['message']
    assert result['performance']['counters']['llm_calls']==0


def test_idempotent_retry_has_one_user_and_one_assistant_and_ownership(db,actor):
    request=uuid.uuid4().hex
    first=chat_service.process_chat(db,actor,'Show my recent files',request_id=request)
    second=chat_service.process_chat(db,actor,'Show my recent files',request_id=request)
    assert second['route']=='replay' and second['conversation_id']==first['conversation_id']
    assert len(conversation_service.get_messages(db,first['conversation_id']))==3
    other=User(name='Other',email=uuid.uuid4().hex+'@test.com',hashed_password='unused');db.add(other);db.commit()
    assert chat_service.process_chat(db,other,'Show my recent files',request_id=request)['error']
    assert chat_service.process_chat(db,other,'Show my recent files',conversation_id=first['conversation_id'])['error']


class FakeClient:
    provider='ollama';model='test-model'
    def __init__(self,db):pass
    def is_configured(self):return True
    async def stream_chat(self,http_client,messages,tools=None,max_tokens=None):
        yield {'type':'delta','text':'First '}
        await asyncio.sleep(0)
        yield {'type':'delta','text':'second.'}
        yield {'type':'round_done','tokens':4}


def test_real_inference_path_streams_and_receives_history(db,actor,monkeypatch):
    seen=[]
    class Client(FakeClient):
        async def stream_chat(self,http_client,messages,**kwargs):
            seen.append(messages)
            async for event in super().stream_chat(http_client,messages,**kwargs):yield event
    monkeypatch.setattr(chat_service,'LLMClient',Client)
    first=chat_service.process_chat(db,actor,'Explain a checksum in one sentence.')
    second=chat_service.process_chat(db,actor,'Explain that with an analogy.',conversation_id=first['conversation_id'])
    assert second['route']=='inference' and second['message']=='First second.'
    assert any(m['content']=='Explain a checksum in one sentence.' for m in seen[1])
    assert any(m['role']=='assistant' for m in seen[1])


def test_cancelled_stream_is_closed_without_partial_assistant_persistence(db,actor,monkeypatch):
    closed=[]
    class Client(FakeClient):
        async def stream_chat(self,*args,**kwargs):
            try:
                yield {'type':'delta','text':'Partial'}
                await asyncio.sleep(20)
            finally:closed.append(True)
    monkeypatch.setattr(chat_service,'LLMClient',Client)
    request=uuid.uuid4().hex
    async def run():
        engine=chat_service.chat_events(db,actor,'Explain a checksum.',request_id=request)
        async for event in engine:
            if event['event']=='delta':
                await engine.aclose();break
    asyncio.run(run())
    assert closed
    turn=db.get(ChatTurn,request)
    assert turn.status=='cancelled'
    assert [m.role for m in conversation_service.get_messages(db,turn.conversation_id)]==['user']


def test_duplicate_tool_calls_are_stopped(db,actor,monkeypatch):
    calls=[]
    class Client(FakeClient):
        async def stream_chat(self,*args,**kwargs):
            calls.append(1)
            yield {'type':'tools','calls':[{'function':{'name':'list_files','arguments':{}}}]}
            yield {'type':'round_done','tokens':1}
    monkeypatch.setattr(chat_service,'LLMClient',Client)
    result=chat_service.process_chat(db,actor,'Compare my files carefully.')
    assert result['error'] and len(calls)==2
    assert 'Repeated' in result['message']


def test_model_payload_redacts_sensitive_fields_and_bounds_data():
    value=chat_service._model_result({'email':'private@test.com','files':[{'name':'a'*1000,'token':'secret'}]*100})
    assert 'secret' not in str(value) and 'private@test.com' not in str(value)


def test_revoked_session_stops_reply_before_persistence(db,actor,monkeypatch):
    from fastapi import HTTPException
    monkeypatch.setattr(chat_service,'LLMClient',FakeClient)
    checks=[]
    def guard():
        checks.append(1)
        if len(checks)>=3:raise HTTPException(401,'Session revoked.')
    result=chat_service.process_chat(db,actor,'Explain a checksum.',request_id=uuid.uuid4().hex,guard=guard)
    assert result['error'] and result['status_code']==401
    assert db.query(ChatMessage).filter_by(conversation_id=result['conversation_id'],role='assistant').count()==0


def test_superseded_worker_cannot_complete_or_fail_new_retry(db,actor):
    from fastapi import HTTPException
    from src.ai_metrics import traced
    request=uuid.uuid4().hex
    old,conv,*_=chat_service._prepare(db,actor,'Explain a checksum.',None,None,None,request)
    old_lease=old.metrics['lease']
    old.status='failed';db.commit()
    newer,*_=chat_service._prepare(db,actor,'Explain a checksum.',None,None,None,request)
    new_lease=newer.metrics['lease']
    assert old_lease!=new_lease
    with traced('test') as trace:
        with pytest.raises(HTTPException):
            chat_service._complete(db,newer,'Stale result',[],None,0,'inference',False,trace,old_lease)
        chat_service._fail_turn(db,request,old_lease,'failed',trace)
        db.expire_all()
        assert db.get(ChatTurn,request).status=='processing'
        chat_service._complete(db,db.get(ChatTurn,request),'Current result',[],None,0,'inference',False,trace,new_lease)
    assert db.query(ChatMessage).filter_by(conversation_id=conv.id,role='assistant').one().content=='Current result'


def test_negative_admin_limit_cannot_expand_result_set(db,actor,monkeypatch):
    monkeypatch.setattr(config_service,'get_int',lambda *args:-5)
    result=functions.execute_function('list_files',{},db,actor)
    assert len(result['files'])<=1


def test_ai_http_endpoints_require_auth(client):
    for path in ['/api/assistant/chat','/api/assistant/chat/stream']:
        assert client.post(path,json={'message':'Show my recent files'}).status_code==401
    assert client.get('/api/assistant/suggestions').status_code==401


def test_stream_rate_limit_is_checked_before_opening_stream(db,actor,monkeypatch):
    from fastapi import HTTPException
    from src.assistant import controller
    from src.assistant.models import ChatRequest
    monkeypatch.setattr(controller,'check_rate_limit',lambda *args:{'allowed':False,'reset_in':30})
    with pytest.raises(HTTPException) as error:
        controller.stream_chat(ChatRequest(message='Show my recent files'),None,db,actor,'unused')
    assert error.value.status_code==429


def test_generic_explanations_do_not_receive_unrelated_product_policy(db,actor):
    from src.assistant import knowledge
    assert knowledge.model_context(db,actor,'Explain why revoking a link cannot erase a downloaded copy.')==''
    assert 'not end-to-end' in knowledge.model_context(db,actor,'Explain how TrustShare encryption protects uploads.')


def test_member_cannot_map_admin_suggestions(client,db,actor):
    from src.api import app
    from src.auth.dependencies import get_current_user
    app.dependency_overrides[get_current_user]=lambda:actor
    try:
        response=client.patch('/api/assistant/admin/suggestions/1/intent',json={'intent_id':'storage.overview'})
        assert response.status_code==403
    finally:app.dependency_overrides.pop(get_current_user,None)
