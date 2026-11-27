"""Real inference on the committed synthetic corpus, with optional baseline code."""
import argparse
import importlib.util
import json
import re
import time
from pathlib import Path
from src.ai_metrics import traced
from src.file_summaries.providers import OllamaProvider


def coverage(text,facts):
    lower=text.lower()
    def has(term):
        return bool(re.search(r'\b(no|not)\b',lower)) if term=='not' else term.lower() in lower
    return sum(all(has(term) for term in fact) for fact in facts)


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--output',required=True)
    parser.add_argument('--baseline-provider');parser.add_argument('--model',action='append');args=parser.parse_args()
    providers={'optimized':OllamaProvider}
    if args.baseline_provider:
        spec=importlib.util.spec_from_file_location('baseline_provider',args.baseline_provider)
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        providers['baseline']=module.OllamaProvider
    corpus=json.loads((Path(__file__).parents[1]/'tests/ai_evaluation.json').read_text(encoding='utf-8'))
    selected=[('cedar','standard'),('cedar','detailed'),('table','detailed'),('injection','short'),('hindi','standard')]
    rows=[]
    for model in args.model or ['qwen2.5:0.5b','qwen2.5:1.5b']:
        for implementation,provider_class in providers.items():
            provider=provider_class(args.url,model,90)
            for case_id,length in selected:
                source=next(item for item in corpus['documents'] if item['id']==case_id)
                with traced('synthetic_quality_evaluation') as trace:
                    started=time.perf_counter()
                    try:
                        result=provider.generate_summary(source['text'],{'summary_length':length,'output_format':'paragraph','output_language':'original','variation':0})
                        evidence=result['summary']+' '+' '.join(result['key_points'])
                        new_numbers=sorted(set(re.findall(r'\d+(?:\.\d+)?',result['summary']))-set(re.findall(r'\d+(?:\.\d+)?',source['text'])))
                        row={'case':case_id,'length':length,'model':model,'implementation':implementation,
                            'seconds':round(time.perf_counter()-started,3),'summary':result['summary'],'supporting_points':result['key_points'],
                            'main_fact_coverage':coverage(result['summary'],source['critical_facts']),
                            'combined_fact_coverage':coverage(evidence,source['critical_facts']),
                            'critical_facts_total':len(source['critical_facts']),'summary_words':len(result['summary'].split()),
                            'new_numeric_tokens_for_review':new_numbers,'injection_marker_present':any(term in result['summary'] for term in source.get('forbidden',[])),
                            'timing':trace.snapshot(),'error':False}
                    except Exception as error:
                        row={'case':case_id,'length':length,'model':model,'implementation':implementation,'error':True,'error_type':type(error).__name__}
                rows.append(row)
                Path(args.output).write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
                print({key:row.get(key) for key in ['model','implementation','case','length','seconds','combined_fact_coverage','critical_facts_total','error']},flush=True)


if __name__=='__main__':main()
