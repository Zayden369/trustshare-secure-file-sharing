"""Six real local-inference options on synthetic documents, with no cache."""
import argparse,hashlib,json,time
from pathlib import Path
from src.file_summaries import providers
from src.file_summaries.providers import OllamaProvider, ExtractiveFallbackProvider, ProviderUnavailable

CASES={
 'security':'''Synthetic workspace security report. Reporting period: last 30 days.
Security score: 92 out of 100. Successful logins: 24. Failed login attempts: 3. Blocked attacks: 0.
Total workspace activities: 51. MFA adoption: 40 percent. File uploads: 12. File downloads: 18. Share links created: 4.
Two share links expired and one link was revoked by its owner. The most recent activity was a successful password login on 26 November 2026.
This report summarizes recorded workspace events only. It is not an independent security audit and does not prove that undetected attacks never occurred.
The recommended action is to enable MFA for remaining users and review failed login attempts. Activity monitoring should continue throughout the next reporting period.''',
 'resume':'''Synthetic Candidate is a computer science undergraduate seeking a software engineering internship. Core skills include Python, Java, SQL, Git and React.
The candidate built a document search prototype using text extraction, keyword retrieval and a React interface. The prototype was evaluated on 120 synthetic documents; 102 of 120 retrieval tasks succeeded.
A second project was an expense tracker with CSV import, transaction categorization and monthly charts. It was developed with Python, SQLite and a responsive web interface.
During a university research placement from June to August 2025, the candidate cleaned tabular datasets, wrote validation scripts and documented reproducible experiments.
Education is a computer science degree expected in 2027. Relevant coursework includes data structures, databases, operating systems and software engineering.
Community work includes reviewing documentation and correcting introductory examples in an open source project. The candidate practices unit testing and explains technical changes in plain language.
The resume claims project and university experience only; it does not claim a professional security certification or production deployment experience.'''
}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--output',required=True);parser.add_argument('--case',choices=list(CASES),action='append');parser.add_argument('--model',default='qwen2.5:0.5b');parser.add_argument('--allow-fallback',action='store_true')
    args=parser.parse_args();provider=OllamaProvider(args.url,args.model,90);rows=[]
    original_post=providers._http_client.post;last={}
    def capture(*a,**kw):
        response=original_post(*a,**kw);last['raw']=response.json().get('response');return response
    providers._http_client.post=capture
    for case in args.case or CASES:
        for format in ['paragraph','bullet_points']:
            for length in ['short','standard','detailed']:
                start=time.perf_counter()
                try:
                    options={'summary_length':length,'output_format':format,'output_language':'original','variation':0}
                    native_error=None
                    try:
                        result=provider.generate_summary(CASES[case],options);name='ollama'
                    except ProviderUnavailable as error:
                        if not args.allow_fallback:raise
                        native_error=str(error);result=ExtractiveFallbackProvider().generate_summary(CASES[case],options);name='extractive_fallback'
                    row={'case':case,'length':length,'format':format,'seconds':round(time.perf_counter()-start,3),'words':len(result['summary'].split()),'bullet_count':sum(line.startswith('- ') for line in result['summary'].splitlines()),'text_hash':hashlib.sha256(result['summary'].encode()).hexdigest(),'provider':name,'native_error':native_error,'result':result,'error':False}
                except Exception as error:
                    row={'case':case,'length':length,'format':format,'error':True,'reason':str(error),'rejected_synthetic_response':last.get('raw')}
                rows.append(row);Path(args.output).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
                print({k:row.get(k) for k in ['case','format','length','seconds','words','bullet_count','provider','error','reason']},flush=True)
    for case in args.case or CASES:
        for format in ['paragraph','bullet_points']:
            group=[row for row in rows if row['case']==case and row['format']==format]
            assert all(not row['error'] for row in group), 'A native generation failed (or run explicitly with --allow-fallback)'
            assert len({row['text_hash'] for row in group})==3, 'Depth choices reused identical text'
            assert [row['result']['content_unit_count'] for row in group]==[2,4,6], 'Unexpected source depth'
            if format=='bullet_points':assert [row['bullet_count'] for row in group]==[2,4,6]
            else:assert not any(row['bullet_count'] for row in group)

if __name__=='__main__':main()
