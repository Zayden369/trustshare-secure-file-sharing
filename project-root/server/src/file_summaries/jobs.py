"""Policy-aware cache identity, fenced workers and observable recovery."""
import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy import exists
from src.entities.file_summary import FileSummary
from src.entities.summary_job import SummaryJob, SummaryRevision
from src.entities.user import User
from src.entities.notification import Notification
from src.entities.audit_log import AuditLog
from src.ai_metrics import traced, current_trace
from src.ai_scheduler import InferenceBusy


def now():
    return datetime.now(timezone.utc)


def aware(value):
    return value.replace(tzinfo=value.tzinfo or timezone.utc)


def policy():
    values = {key:os.getenv(key,'') for key in ['AI_SUMMARY_PROVIDER','SUMMARY_OLLAMA_MODEL','OLLAMA_MODEL',
        'HF_SUMMARY_MODEL','SUMMARY_MODEL_REVISION','SUMMARY_MODEL_INPUT_CHARACTERS','SUMMARY_MAX_EXTRACTED_CHARACTERS']}
    values['implementation'] = 'summary-depth-v6'
    return hashlib.sha256(json.dumps(values,sort_keys=True).encode()).hexdigest()


def recover(db, summary):
    job=db.get(SummaryJob,summary.id)
    updated=job.updated_at if job else summary.updated_at
    if summary.status in {'pending','processing'} and updated and (now()-aware(updated)).total_seconds()>300:
        summary.status='failed'
        summary.error_message='This summary job was interrupted. Choose Try again to recover it.'
        if job:
            job.generation_id=uuid.uuid4().hex  # Fences any late result from an old worker.
            job.phase='failed'
        db.commit()
    return job


def decorate(db, summary):
    job=recover(db,summary)
    summary.stage=job.phase if job else summary.status
    summary.performance=job.metrics if job else None
    summary.generation_policy=job.policy if job else 'legacy'
    summary.generation_id=job.generation_id if job else None
    summary.is_stale=summary.status=='completed' and (job is None or job.policy!=policy())
    return summary


def _snapshot(db, summary, job):
    from src.file_summaries.models import SummaryOut
    generation=job.generation_id if job else uuid.uuid4().hex
    if summary.status=='completed' and not db.get(SummaryRevision,generation):
        db.add(SummaryRevision(generation_id=generation,summary_id=summary.id,
            policy=job.policy if job else 'legacy',result=SummaryOut.model_validate(summary).model_dump(mode='json')))


def create_summary(db,file_id,user_id,data):
    from src.file_summaries import service
    with traced('summary_request') as trace:
        with trace.stage('authorization'):
            file=service.authorize_file(db,file_id,user_id)
        if data.file_version_id is not None:
            raise HTTPException(400,'File version identifiers are not available in this project.')
        max_bytes=service._int_env('SUMMARY_MAX_FILE_SIZE_MB',20)*1024*1024
        if file.size>max_bytes:
            raise HTTPException(413,f'File exceeds the {max_bytes//1024//1024} MB summary limit.')
        checksum=file.hash_sha256 or f'metadata-{file.id}-{file.version}-{file.size}'
        with trace.stage('cache_lookup'):
            summary=db.query(FileSummary).filter_by(file_id=file.id,source_file_version=file.version or 1,
                source_checksum=checksum,summary_length=data.summary_length,output_language=data.output_language,
                output_format=data.output_format).first()
            job=recover(db,summary) if summary else None
        current_policy=policy()
        if summary and summary.status in {'pending','processing'}:
            raise HTTPException(409,{'message':'An identical summary is already being generated.','summary_id':summary.id})
        if summary and summary.status=='completed' and not data.force_regenerate:
            policy_valid=job is not None and job.policy==current_policy
            refresh=False
            if summary.provider=='extractive_fallback' and (not job or not job.provider_retry_at or aware(job.provider_retry_at)<=now()):
                try:
                    provider=service._provider()
                    refresh=provider.name!='extractive_fallback' and provider.health_check()
                except service.ProviderUnavailable:
                    pass
            if policy_valid and not refresh:
                trace.counters['cache_hit']=1
                trace.emit('cached')
                return decorate(db,summary),True
        try:
            with trace.stage('job_persistence'):
                if summary:
                    previous_status=summary.status
                    # Atomically claim a new generation even on SQLite, where FOR UPDATE is ignored.
                    lease=exists().where(SummaryJob.summary_id==summary.id)
                    if job:
                        lease=lease.where(SummaryJob.generation_id==job.generation_id)
                    else:
                        lease=~lease
                    changed=db.query(FileSummary).filter(FileSummary.id==summary.id,FileSummary.status==previous_status,
                        lease).update({'status':'pending','updated_at':now()},synchronize_session=False)
                    if changed!=1:
                        db.rollback();raise HTTPException(409,'An identical summary is already being generated.')
                    _snapshot(db,summary,job)
                    summary.status='pending'
                    summary.requested_by_user_id=user_id
                    summary.error_message=None
                    summary.warning_message=None
                else:
                    summary=FileSummary(file_id=file.id,source_file_version=file.version or 1,requested_by_user_id=user_id,
                        status='pending',summary_length=data.summary_length,output_language=data.output_language,
                        output_format=data.output_format,source_checksum=checksum)
                    db.add(summary);db.flush()
                if not job:
                    job=SummaryJob(summary_id=summary.id,generation_id=uuid.uuid4().hex,policy=current_policy)
                    db.add(job)
                job.generation_id=uuid.uuid4().hex
                job.policy=current_policy
                job.phase='queued'
                job.metrics=None
                job.provider_retry_at=None
                job.queued_at=now()
                job.updated_at=now()
                job.request_metrics=trace.snapshot()
                db.commit();db.refresh(summary)
        except IntegrityError:
            db.rollback();raise HTTPException(409,'An identical summary is already being generated.') from None
        trace.emit('queued')
        return decorate(db,summary),False


def process_summary(summary_id,variation=0,queue_started=None):
    from src.file_summaries import service
    db=service.SessionLocal();plaintext=None;generation=None;status='failed'
    with traced('summary_generation') as trace:
        if queue_started is not None:
            trace.stages['background_wait']=max(0,time.perf_counter()-queue_started)*1000
        try:
            summary=db.get(FileSummary,summary_id)
            if not summary or summary.status!='pending':
                return
            job=db.get(SummaryJob,summary_id)
            if not job:
                job=SummaryJob(summary_id=summary_id,generation_id=uuid.uuid4().hex,policy=policy(),phase='queued')
                db.add(job);db.flush()
            generation=job.generation_id
            changed=db.query(FileSummary).filter_by(id=summary_id,status='pending').update({'status':'processing'},synchronize_session=False)
            if changed!=1:
                db.rollback();return
            job.phase='reading';db.commit()
            actor=db.get(User,summary.requested_by_user_id)
            if not actor or not actor.is_active:
                raise HTTPException(403,'The requesting account is no longer active.')
            with trace.stage('authorization'):
                file=service.authorize_file(db,summary.file_id,actor.id)
            plaintext=bytearray(service._load_plaintext(file))
            job.phase='extracting';db.commit()
            with trace.stage('text_extraction'):
                full_text=service.extract_text(file.original_name,bytes(plaintext))
            trace.counters['extracted_characters']=len(full_text)
            with trace.stage('preprocessing'):
                fallback_text=full_text
                extraction_warning=None
                max_characters=max(3000,service._int_env('SUMMARY_MAX_EXTRACTED_CHARACTERS',120000))
                if len(full_text)>max_characters:
                    fallback_text,extraction_warning=service._source_for_model(full_text,character_limit=max_characters)
                    if extraction_warning:
                        extraction_warning='The extracted-text processing limit was reached. Only selected start, middle and end excerpts were processed.'
                source,excerpt_warning=service._source_for_model(fallback_text)
                trace.counters['model_input_characters']=len(source)
            job.phase='waiting_for_inference';db.commit()
            def mark_generating():
                job.phase='generating';db.commit()
            trace.on_inference_start=mark_generating
            options={'summary_length':summary.summary_length,'output_language':summary.output_language,
                'output_format':summary.output_format,'variation':variation}
            result,provider,warning=service._run_provider(source,options,fallback_text=fallback_text)
            with trace.stage('output_validation'):
                if not isinstance(result.get('summary'),str) or not result['summary'].strip():
                    raise service.ProviderUnavailable('Provider returned an empty summary')
            db.expire_all()
            summary=db.get(FileSummary,summary_id);job=db.get(SummaryJob,summary_id)
            if not summary or not job or job.generation_id!=generation:
                return
            # Permission, source version and checksum can change while a job waits.
            with trace.stage('authorization_recheck'):
                actor=db.get(User,summary.requested_by_user_id)
                if not actor or not actor.is_active:
                    raise HTTPException(403,'The requesting account is no longer active.')
                file=service.authorize_file(db,summary.file_id,actor.id)
                checksum=file.hash_sha256 or f'metadata-{file.id}-{file.version}-{file.size}'
                if (file.version or 1)!=summary.source_file_version or checksum!=summary.source_checksum:
                    raise HTTPException(409,'The file changed during generation. Generate a summary for its current version.')
            with trace.stage('depth_validation'):
                result,provider,warning=service._respect_depth(db,summary,result,provider,warning,source,options,fallback_text)
                trace.counters['summary_content_units']=result.get('content_unit_count',len(result.get('key_points',[])))
            with trace.stage('database_persistence'):
                summary.title=result.get('title') or 'Document summary'
                summary.summary_text=result['summary']
                summary.key_points=result.get('key_points',[])
                summary.keywords=result.get('keywords',[])
                summary.provider=provider.name;summary.model_name=provider.model_name
                summary.extracted_character_count=len(full_text)
                summary.processing_time_ms=int((time.perf_counter()-trace.started)*1000)
                summary.warning_message=' '.join(filter(None,[extraction_warning,excerpt_warning if provider.name!='extractive_fallback' else None,warning])) or None
                summary.status='completed';summary.generated_at=now()
                db.add(AuditLog(user_id=actor.id,action='AI_SUMMARY_GENERATED',resource_type='file',resource_name=file.original_name,level='info'))
                with trace.stage('notification_creation'):
                    db.add(Notification(user_id=actor.id,type='summary',category='activity',title='File summary ready',message=f'Your summary for "{file.original_name}" is ready.',icon='sparkles'))
                job.phase='completed'
                job.provider_retry_at=now()+timedelta(seconds=120) if provider.name=='extractive_fallback' else None
                db.flush()
            job.metrics=trace.snapshot()
            db.commit()
            status='completed'
        except Exception as error:
            db.rollback()
            summary=db.get(FileSummary,summary_id);job=db.get(SummaryJob,summary_id)
            if summary and job and job.generation_id==generation:
                summary.status='failed'
                if isinstance(error,HTTPException):
                    detail=error.detail
                    summary.error_message=detail.get('message','The document could not be processed.') if isinstance(detail,dict) else str(detail)
                elif isinstance(error,InferenceBusy):
                    summary.error_message=str(error)
                elif isinstance(error,service.ProviderUnavailable):
                    summary.error_message='The AI summary provider is unavailable. Please retry.'
                else:
                    summary.error_message='Summary generation failed safely. Try again or upload a readable document.'
                job.phase='failed';job.metrics=trace.snapshot()
                db.add(AuditLog(user_id=summary.requested_by_user_id,action='AI_SUMMARY_FAILED',resource_type='file',resource_name='AI file summary',level='error'))
                db.commit()
        finally:
            trace.emit(status)
            if plaintext is not None:
                plaintext[:]=b'\x00'*len(plaintext)
            db.close()
