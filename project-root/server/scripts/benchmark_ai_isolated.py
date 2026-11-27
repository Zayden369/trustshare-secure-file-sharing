"""Bounded synthetic engine benchmark; never connects to the application DB.

Use a new directory under /tmp/ts_ai_bench_*; no HTTP listener is started.
"""
import argparse
import asyncio
import json
import os
import secrets
import time
from pathlib import Path


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--directory',required=True)
    parser.add_argument('--ollama',default='http://ollama:11434')
    args=parser.parse_args()
    directory=Path(args.directory).resolve()
    if directory.parent != Path('/tmp') or not directory.name.startswith('ts_ai_bench_') or directory.exists():
        raise SystemExit('Use a NEW /tmp/ts_ai_bench_* directory; existing data is never modified.')
    directory.mkdir(mode=0o700)
    os.environ.update(DATABASE_URL='sqlite:///'+str(directory/'synthetic.db'),REQUIRE_POSTGRESQL='false',
        ENVIRONMENT='development',SECRET_KEY=secrets.token_hex(32),MASTER_KEY_HEX=secrets.token_hex(32),
        ALLOW_EXTERNAL_AI='false',ALLOW_EXTERNAL_ACCOUNT_AI='false',AI_SUMMARY_PROVIDER='ollama',
        OLLAMA_BASE_URL=args.ollama,SUMMARY_OLLAMA_MODEL='qwen2.5:0.5b',SUMMARY_OLLAMA_THREADS='2',ASSISTANT_OLLAMA_THREADS='2')
    from src.database.init_db import init_db
    from src.database.core import SessionLocal
    from src.entities.user import User
    from src.assistant import chat_service,config_service,intents
    from src.ai_metrics import traced
    from src.file_summaries import service
    init_db()
    output={'scope':'Isolated synthetic engine, excludes HTTP/JWT/upload/extraction','predefined':[],'custom':[],'summaries':[]}
    with SessionLocal() as db:
        user=User(name='Synthetic engine benchmark',email='synthetic@example.com',hashed_password='unusable')
        db.add(user);db.commit()
        for key,value in {'ENABLE_ASSISTANT':True,'LLM_PROVIDER':'ollama','LLM_MODEL':'qwen2.5:1.5b',
                          'LLM_BASE_URL':args.ollama+'/v1','LLM_MAX_TOKENS':512,'LLM_TEMPERATURE':0.2,'LLM_TIMEOUT_SECONDS':60}.items():
            config_service.set_value(db,key,value)
        for repeat in range(2):
            for intent in intents.INTENTS:
                start=time.perf_counter()
                result=chat_service.process_chat(db,user,intent.aliases[0])
                output['predefined'].append({'intent':intent.id,'seconds':time.perf_counter()-start,'error':result.get('error',False),'performance':result.get('performance')})
        async def turn(message):
            start=time.perf_counter();first=None;final={}
            async for event in chat_service.chat_events(db,user,message):
                if event['event']=='delta' and first is None and event['data']['text'].strip():first=time.perf_counter()-start
                if event['event'] in {'done','error'}:final=event['data']
            return {'message':message,'seconds':time.perf_counter()-start,'first_meaningful_seconds':first,'result':final}
        for message in ['Explain what a checksum does in two concise sentences.',
                        'Explain why revoking a link cannot erase an already downloaded copy. Keep it concise.',
                        'Compare my file sizes and storage usage using the available tools.']:
            output['custom'].append(asyncio.run(turn(message)))
        source='Project Cedar enrolled 24 volunteers. Reviewers completed 162 of 180 tasks over six weeks. Files are encrypted on the server before storage. Owners may revoke links. No independent security audit or certification is claimed.'
        for length in ['short','standard','detailed']:
            with traced('synthetic_summary') as trace:
                start=time.perf_counter()
                result,provider,warning=service._run_provider(source,{'summary_length':length,'output_format':'paragraph','output_language':'original','variation':0})
                output['summaries'].append({'length':length,'seconds':time.perf_counter()-start,'provider':provider.name,
                    'warning':warning,'result':result,'performance':trace.snapshot()})
    (directory/'results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(output,ensure_ascii=False))


if __name__=='__main__':main()
