"""Synthetic-only HTTP benchmarks. Never accepts real documents or prints JWTs.

python scripts/benchmark_ai.py --url http://localhost:8011 --credentials /path/to/synthetic-credentials.json --output results.json
"""
import argparse
import json
import math
import statistics
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import httpx

QUESTIONS=[
 'Show me my recent files','Find all PDFs I uploaded this month','What are my largest files?',
 'How much storage do I have left?','Show my storage breakdown by category','What files have I shared with others?',
 'Show my active share links','Show my active login sessions','Do I have any unread notifications?',"What's my account information?",
]


def percentiles(rows):
    values=sorted(row['seconds'] for row in rows)
    if not values:return {'n':0}
    return {'n':len(values),'p50':round(statistics.median(values),4),
            'p95':round(values[max(0,math.ceil(len(values)*0.95)-1)],4),'max':round(max(values),4)}


def stream_turn(client,message,conversation_id=None):
    start=time.perf_counter();first=None;final=None;current=None;event=None;deltas=0
    payload={'message':message,'request_id':uuid.uuid4().hex}
    if conversation_id:payload['conversation_id']=conversation_id
    with client.stream('POST','/api/assistant/chat/stream',json=payload) as response:
        response.raise_for_status()
        for line in response.iter_lines():
            if line.startswith('event:'):event=line[6:].strip()
            elif line.startswith('data:'):
                data=json.loads(line[5:])
                if event=='meta':current=data['conversation_id']
                elif event=='delta':
                    deltas+=1
                    if first is None and data.get('text','').strip():first=time.perf_counter()-start
                elif event in {'done','error'}:final=data
    return {'seconds':round(time.perf_counter()-start,4),'first_meaningful_seconds':round(first,4) if first is not None else None,
            'delta_events':deltas,'error':not final or final.get('error',False),
            'route':final.get('route') if final else None,'backend':final.get('performance') if final else None,
            'conversation_id':current,'text':final.get('message') if final else None}


def summarize(client,file_id,length,format,force=True):
    started=time.perf_counter()
    response=client.post(f'/api/files/{file_id}/summaries',json={'summary_length':length,'output_format':format,'force_regenerate':force})
    response.raise_for_status();data=response.json()
    for _ in range(240):
        if data['status'] in {'completed','failed'}:break
        time.sleep(0.75)
        response=client.get(f'/api/files/{file_id}/summaries/{data["id"]}');response.raise_for_status();data=response.json()
    return {'seconds':round(time.perf_counter()-started,4),'error':data['status']!='completed',
            'provider':data.get('provider'),'model':data.get('model_name'),'cached':data.get('cached',False),
            'inference_calls_this_request':0 if data.get('cached') else (data.get('performance') or {}).get('counters',{}).get('llm_calls',0),
            'backend':data.get('performance'),'length':length,'format':format,
            'summary':data.get('summary_text'),'key_points':data.get('key_points',[]),'summary_id':data['id']}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--credentials',required=True)
    parser.add_argument('--output',required=True);parser.add_argument('--quick',action='store_true')
    args=parser.parse_args()
    for attempt in range(60):
        try:
            if httpx.get(args.url+'/health/ready',timeout=2).is_success:
                break
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    else:
        raise RuntimeError('Review backend did not become ready.')
    credentials=json.loads(Path(args.credentials).read_text(encoding='utf-8'))
    corpus=json.loads((Path(__file__).parents[1]/'tests/ai_evaluation.json').read_text(encoding='utf-8'))
    clients=[];created=[];result={'environment':args.url,'predefined':[],'knowledge':[],'custom':[],'summaries':[]}
    try:
        for email in [credentials['email'],credentials['member_email']]:
            client=httpx.Client(base_url=args.url,timeout=150)
            response=client.post('/api/auth/login',json={'email':email,'password':credentials['password']});response.raise_for_status()
            client.headers['Authorization']='Bearer '+response.json()['access_token'];clients.append(client)
        for index,client in enumerate(clients):
            document=corpus['documents'][index]
            response=client.post('/api/files/upload',files={'file':(document['id']+'-'+uuid.uuid4().hex+'.txt',document['text'].encode(),'text/plain')});response.raise_for_status()
            created.append((client,response.json()['id'],document))
        for repeat in range(2):
            for index,question in enumerate(QUESTIONS):
                row=stream_turn(clients[(index+repeat)%2],question)
                row.update({'question':question,'repeat':repeat});result['predefined'].append(row)
        print('Predefined',percentiles(result['predefined']),flush=True)
        for message in ['How many files can I upload at once?','Is TrustShare end-to-end encrypted?','Which files support AI summary?']:
            row=stream_turn(clients[0],message);row['question']=message;result['knowledge'].append(row)
        print('Knowledge',percentiles(result['knowledge']),flush=True)
        for repeat in range(1 if args.quick else 2):
            for case in corpus['custom_questions']:
                row=stream_turn(clients[1],case['message']);row['case']=case['id'];result['custom'].append(row)
                print('Custom',case['id'],row['seconds'],row['first_meaningful_seconds'],row['error'],flush=True)
        combinations=[('short','paragraph'),('standard','paragraph'),('detailed','paragraph'),('short','bullet_points'),('standard','bullet_points'),('detailed','bullet_points')]
        for index,(length,format) in enumerate(combinations):
            client,file_id,document=created[index%2]
            row=summarize(client,file_id,length,format)
            row['document']=document['id']
            evidence=' '.join([row.get('summary') or '']+row.get('key_points',[])).lower()
            row['critical_facts_covered']=sum(all(term.lower() in evidence for term in fact) for fact in document['critical_facts'])
            row['critical_facts_total']=len(document['critical_facts'])
            result['summaries'].append(row)
            print('Summary',length,format,row['seconds'],row['provider'],row['critical_facts_covered'],row['critical_facts_total'],flush=True)
        client,file_id,document=created[0]
        result['cached_summary']=summarize(client,file_id,'standard','bullet_points',force=False)
        # A real summary runs while database-only assistant questions remain available.
        with ThreadPoolExecutor(max_workers=2) as pool:
            task=pool.submit(summarize,clients[1],created[1][1],'short','paragraph')
            time.sleep(0.15)
            fast=stream_turn(clients[0],'Show me my recent files')
            slow=task.result()
        result['concurrent']={'assistant':fast,'summary':slow}
        print('Concurrent',fast['seconds'],slow['seconds'],flush=True)
        result['statistics']={key:percentiles(result[key]) for key in ['predefined','knowledge','custom','summaries']}
        result['statistics']['genuine_custom_ai']=percentiles([row for row in result['custom'] if row['route']=='inference'])
    finally:
        for client,file_id,_ in created:
            try:client.delete(f'/api/files/{file_id}')
            except httpx.HTTPError:pass
        for client in clients:client.close()
        Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print('Results saved; only synthetic documents and account questions were used.',flush=True)


if __name__=='__main__':main()
