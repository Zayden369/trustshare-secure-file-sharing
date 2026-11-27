import io
import uuid
from datetime import timedelta
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import sessionmaker
from src.entities.user import User
from src.entities.file import File
from src.entities.file_permission import FilePermission
from src.entities.file_summary import FileSummary
from src.entities.summary_job import SummaryJob, SummaryRevision
from src.file_summaries import service, jobs
from src.file_summaries.models import SummaryCreate
from src.file_summaries.providers import _parse_json, ProviderUnavailable, ExtractiveFallbackProvider
from src.file_summaries.text_extraction import extract_text

TEXT='Project Cedar stores encrypted files. Owners control reviewer permissions. Audit events track downloads. The pilot involved 24 volunteers. No independent certification is claimed.'


def test_history_combines_other_options_and_saved_generations_without_current_or_other_files(db, document):
    user, file, _ = document
    paragraph, _ = service.create_summary(db, file.id, user.id, SummaryCreate())
    service.process_summary(paragraph.id); db.expire_all()
    old_generation = db.get(SummaryJob, paragraph.id).generation_id
    bullets, _ = service.create_summary(db, file.id, user.id, SummaryCreate(summary_length='short', output_format='bullet_points'))
    service.process_summary(bullets.id); db.expire_all()
    another_file = File(owner_id=user.id, original_name='other.txt', stored_name=uuid.uuid4().hex, size=len(TEXT), encrypted=False, version=1)
    db.add(another_file); db.commit()
    unrelated, _ = service.create_summary(db, another_file.id, user.id, SummaryCreate())
    service.process_summary(unrelated.id); db.expire_all()
    paragraph, _ = service.create_summary(db, file.id, user.id, SummaryCreate(force_regenerate=True))
    service.process_summary(paragraph.id); db.expire_all()
    history = service.summary_history(db, file.id, paragraph.id, user.id)
    assert len(history) == 2
    assert {entry['generation_id'] for entry in history} == {old_generation, db.get(SummaryJob, bullets.id).generation_id}
    assert {entry['result']['output_format'] for entry in history} == {'paragraph', 'bullet_points'}
    assert all(entry['result']['file_id'] == file.id for entry in history)


def test_history_empty_and_unauthorized_access(db, document):
    user, file, _ = document
    summary, _ = service.create_summary(db, file.id, user.id, SummaryCreate())
    service.process_summary(summary.id); db.expire_all()
    assert service.summary_history(db, file.id, summary.id, user.id) == []
    stranger = User(name='Unrelated', email=uuid.uuid4().hex+'@example.com', hashed_password='unused')
    db.add(stranger); db.commit()
    with pytest.raises(HTTPException) as error:
        service.summary_history(db, file.id, summary.id, stranger.id)
    assert error.value.status_code == 403


@pytest.fixture
def document(db,monkeypatch):
    user=User(name='Synthetic summary user',email=uuid.uuid4().hex+'@test.com',hashed_password='unused')
    db.add(user);db.flush()
    file=File(owner_id=user.id,original_name='synthetic.txt',stored_name=uuid.uuid4().hex,mimetype='text/plain',size=len(TEXT),encrypted=False,version=1,hash_sha256='a'*64)
    db.add(file);db.commit()
    factory=sessionmaker(bind=db.get_bind())
    monkeypatch.setattr(service,'SessionLocal',factory)
    monkeypatch.setattr(service,'_load_plaintext',lambda _:TEXT.encode())
    monkeypatch.setenv('AI_SUMMARY_PROVIDER','extractive_fallback')
    return user,file,factory


@pytest.mark.parametrize('length',['short','standard','detailed'])
@pytest.mark.parametrize('format',['paragraph','bullet_points'])
def test_lengths_formats_cache_and_fresh_regeneration(db,document,length,format):
    user,file,factory=document
    options=SummaryCreate(summary_length=length,output_format=format)
    first,cached=service.create_summary(db,file.id,user.id,options)
    assert not cached
    service.process_summary(first.id)
    db.expire_all();first=db.get(FileSummary,first.id)
    assert first.status=='completed' and first.provider=='extractive_fallback'
    assert first.summary_text.startswith('- ')==(format=='bullet_points')
    cached,hit=service.create_summary(db,file.id,user.id,options)
    assert hit
    old_id=db.get(SummaryJob,first.id).generation_id
    fresh,hit=service.create_summary(db,file.id,user.id,options.model_copy(update={'force_regenerate':True}))
    assert not hit and db.get(SummaryJob,first.id).generation_id!=old_id
    revision=db.get(SummaryRevision,old_id)
    assert revision.result['status']=='completed' and revision.result['summary_text']
    service.process_summary(first.id,variation=3)
    db.expire_all();assert db.get(FileSummary,first.id).status=='completed'


def test_force_does_not_bypass_concurrent_job_and_worker_claims_once(db,document,monkeypatch):
    user,file,_=document
    summary,_=service.create_summary(db,file.id,user.id,SummaryCreate())
    with pytest.raises(HTTPException) as error:
        service.create_summary(db,file.id,user.id,SummaryCreate(force_regenerate=True))
    assert error.value.status_code==409
    calls=[]
    provider=ExtractiveFallbackProvider()
    monkeypatch.setattr(service,'_run_provider',lambda text,options,fallback_text=None:(calls.append(1) or provider.generate_summary(fallback_text,options),provider,None))
    service.process_summary(summary.id);service.process_summary(summary.id)
    assert len(calls)==1


def test_revoked_permission_prevents_queued_work_and_cached_reads(db,document):
    owner,file,_=document
    reader=User(name='Reader',email=uuid.uuid4().hex+'@test.com',hashed_password='unused');db.add(reader);db.flush()
    grant=FilePermission(file_id=file.id,user_id=reader.id,permission_level='view',granted_by=owner.id);db.add(grant);db.commit()
    summary,_=service.create_summary(db,file.id,reader.id,SummaryCreate())
    db.delete(grant);db.commit();service.process_summary(summary.id)
    db.expire_all();assert db.get(FileSummary,summary.id).status=='failed'
    with pytest.raises(HTTPException):service.get_summary(db,file.id,summary.id,reader.id)


def test_stale_jobs_recover_and_rotate_fencing_token(db,document):
    user,file,_=document
    summary,_=service.create_summary(db,file.id,user.id,SummaryCreate())
    job=db.get(SummaryJob,summary.id);old_token=job.generation_id
    job.updated_at=jobs.now()-timedelta(minutes=8);summary.status='processing';db.commit()
    recovered=service.get_summary(db,file.id,summary.id,user.id)
    assert recovered.status=='failed' and 'interrupted' in recovered.error_message
    assert job.generation_id!=old_token


def test_policy_change_preserves_old_completed_result(db,document,monkeypatch):
    user,file,_=document
    summary,_=service.create_summary(db,file.id,user.id,SummaryCreate());service.process_summary(summary.id)
    db.expire_all();old=db.get(SummaryJob,summary.id).generation_id
    monkeypatch.setenv('SUMMARY_MODEL_REVISION','new-tested-revision')
    summary,cached=service.create_summary(db,file.id,user.id,SummaryCreate())
    assert not cached and db.get(SummaryRevision,old).result['summary_text']


def test_source_change_during_inference_cannot_save_stale_result(db,document,monkeypatch):
    user,file,factory=document
    summary,_=service.create_summary(db,file.id,user.id,SummaryCreate())
    def generate(text,options,fallback_text=None):
        with factory() as changed:
            row=changed.get(File,file.id);row.version=2;row.hash_sha256='b'*64;changed.commit()
        provider=ExtractiveFallbackProvider()
        return provider.generate_summary(text,options),provider,None
    monkeypatch.setattr(service,'_run_provider',generate)
    service.process_summary(summary.id)
    db.expire_all();saved=db.get(FileSummary,summary.id)
    assert saved.status=='failed' and 'changed during generation' in saved.error_message


def test_file_delete_removes_job_and_revision_metadata_before_id_reuse(db,document):
    from src.files.service import delete_file
    user,file,_=document
    summary,_=service.create_summary(db,file.id,user.id,SummaryCreate());service.process_summary(summary.id)
    db.expire_all()
    service.create_summary(db,file.id,user.id,SummaryCreate(force_regenerate=True))
    summary_id=summary.id
    delete_file(db,file.id,user.id)
    assert db.get(SummaryJob,summary_id) is None
    assert db.query(SummaryRevision).filter_by(summary_id=summary_id).count()==0
    assert db.get(FileSummary,summary_id) is None
    next_file=File(owner_id=user.id,original_name='next.txt',stored_name=uuid.uuid4().hex,mimetype='text/plain',size=10,encrypted=False,version=1)
    db.add(next_file);db.commit()
    next_summary,_=service.create_summary(db,next_file.id,user.id,SummaryCreate())
    assert next_summary.status=='pending'


@pytest.mark.parametrize('response',['{"summary":null}','{"summary":{"fake":"text"}}','{"summary":"ok","key_points":[{}]}','{"summary":"ok","keywords":"invalid"}'])
def test_malformed_output_is_not_saved_as_a_success(response):
    with pytest.raises(ProviderUnavailable):_parse_json(response)


def test_docx_and_powerpoint_tables_are_extracted_in_source_order():
    from docx import Document
    from pptx import Presentation
    from pptx.util import Inches
    doc=Document();doc.add_paragraph('Before table.')
    table=doc.add_table(rows=2,cols=2);table.cell(0,0).text='Volunteers';table.cell(0,1).text='24';table.cell(1,0).text='Tasks';table.cell(1,1).text='180'
    doc.add_paragraph('After table.');buffer=io.BytesIO();doc.save(buffer)
    extracted=extract_text('table.docx',buffer.getvalue())
    assert extracted.index('Before')<extracted.index('Volunteers')<extracted.index('After')
    assert '24' in extracted and '180' in extracted
    deck=Presentation();slide=deck.slides.add_slide(deck.slide_layouts[6])
    table=slide.shapes.add_table(1,2,Inches(1),Inches(1),Inches(4),Inches(1)).table
    table.cell(0,0).text='Verified metric';table.cell(0,1).text='162 completed'
    buffer=io.BytesIO();deck.save(buffer)
    assert '162 completed' in extract_text('table.pptx',buffer.getvalue())


@pytest.mark.parametrize('name,data',[('sample.txt',TEXT.encode()),('sample.md',('# Project\n'+TEXT).encode()),('table.csv',b'Name,Count\nVolunteers,24'),('hindi.txt','परियोजना में चौबीस स्वयंसेवक शामिल थे। दस्तावेज सुरक्षित रखे गए।'.encode())])
def test_supported_text_and_language_input_is_retained(name,data):
    text=extract_text(name,data)
    assert text
    if name=='hindi.txt':assert 'स्वयंसेवक' in text


def test_short_table_rows_survive_supporting_point_selection():
    source='Synthetic pilot results\nMetric | Value\nVolunteers | 24\nTasks | 180\nCompleted | 162\nDuration | 6 weeks\nThe remaining 18 tasks failed. This is a pilot dataset, not a certified security audit.'
    result=ExtractiveFallbackProvider().generate_summary(source,{'summary_length':'detailed','output_format':'paragraph'})
    evidence=' '.join(result['key_points'])
    assert '24' in evidence and '162' in evidence and '18' in evidence and 'audit' in evidence


def test_unsupported_quantities_and_wrong_source_language_are_rejected():
    from src.file_summaries.providers import _validate_source_fidelity
    with pytest.raises(ProviderUnavailable):
        _validate_source_fidelity('162 tasks succeeded out of 180.',{'summary':'162 out of 300 tasks succeeded.'})
    with pytest.raises(ProviderUnavailable):
        _validate_source_fidelity('इस परीक्षण परियोजना में स्वयंसेवकों ने भाग लिया। दस्तावेज़ सर्वर पर एन्क्रिप्ट किए जाते हैं।',{'summary':'所有文件都经过加密，参与者完成任务。'})
    _validate_source_fidelity('162 tasks succeeded out of 180.',{'summary':'1. 162 tasks succeeded.\n2. 180 were attempted.'})


def test_xlsx_table_values_and_multi_page_pdf_are_extracted():
    from openpyxl import Workbook
    from pypdf import PdfWriter
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
    workbook=Workbook();sheet=workbook.active;sheet.append(['Volunteers',24]);sheet.append(['Completed',162])
    buffer=io.BytesIO();workbook.save(buffer);workbook.close()
    assert 'Volunteers | 24' in extract_text('metrics.xlsx',buffer.getvalue())
    writer=PdfWriter()
    for word in ['Synthetic first page','Synthetic second page']:
        page=writer.add_blank_page(width=612,height=792)
        font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        stream=DecodedStreamObject();stream.set_data(('BT /F1 12 Tf 50 700 Td ('+word+') Tj ET').encode())
        page[NameObject('/Contents')]=writer._add_object(stream)
    buffer=io.BytesIO();writer.write(buffer)
    extracted=extract_text('two-pages.pdf',buffer.getvalue())
    assert extracted.index('first page')<extracted.index('second page')


def test_standard_support_retains_measured_result_and_audit_caveat():
    import json
    from pathlib import Path
    text=json.loads((Path(__file__).parent/'ai_evaluation.json').read_text(encoding='utf-8'))['documents'][0]['text']
    result=ExtractiveFallbackProvider().generate_summary(text,{'summary_length':'standard','output_format':'paragraph'})
    points=' '.join(result['key_points'])
    assert all(term in points for term in ['24','180','162','audit','not certified'])


def test_legacy_cache_is_rebuilt_and_old_result_remains_in_history(db, document):
    user, file, _ = document
    summary, _ = service.create_summary(db, file.id, user.id, SummaryCreate())
    summary.status = 'completed'; summary.summary_text = 'Earlier saved summary.'
    db.delete(db.get(SummaryJob, summary.id)); db.commit()
    assert service.get_summary(db, file.id, summary.id, user.id).is_stale
    returned, cached = service.create_summary(db, file.id, user.id, SummaryCreate())
    assert not cached and returned.status == 'pending'
    old = db.query(SummaryRevision).filter_by(summary_id=summary.id).one()
    assert old.result['summary_text'] == 'Earlier saved summary.'
    service.process_summary(summary.id); db.expire_all()
    assert not service.get_summary(db, file.id, summary.id, user.id).is_stale


@pytest.mark.parametrize('format,field',[('paragraph','sentences'),('bullet_points','key_points')])
def test_native_schema_requires_different_depth_for_all_lengths(format, field):
    from src.file_summaries.providers import _ollama_request, _parse_ollama_result
    source=' '.join(f'The synthetic section {i} records a different verified finding and provides its original context without making unsupported claims.' for i in range(8))
    for length, target in [('short',2),('standard',4),('detailed',6)]:
        _, schema = _ollama_request(source, {'summary_length':length,'output_format':format})
        assert schema['required'] == [field]
        assert schema['properties'][field]['minItems'] == schema['properties'][field]['maxItems'] == target
        import json
        items=[f'The synthetic section {i} records a different verified finding and provides its original context without making unsupported claims.' for i in range(target)]
        result=_parse_ollama_result(json.dumps({field:items}),source,{'summary_length':length,'output_format':format})
        assert result['summary'] == ' '.join(items)
        with pytest.raises(ProviderUnavailable):
            _parse_ollama_result(json.dumps({field:[items[0]]*target}),source,{'summary_length':length,'output_format':format})
        with pytest.raises(ProviderUnavailable):
            _parse_ollama_result(json.dumps({field:['A heading']*target}),source,{'summary_length':length,'output_format':format})


def test_quantities_keep_units_and_positive_counts_are_not_negated():
    from src.file_summaries.providers import _validate_source_fidelity
    source='Reporting period: last 30 days. Failed login attempts: 3. Blocked attacks: 0. Activity count: 3.'
    with pytest.raises(ProviderUnavailable):
        _validate_source_fidelity(source,{'summary':'The report covers 3 days.'})
    with pytest.raises(ProviderUnavailable):
        _validate_source_fidelity(source,{'summary':'There were no failed login attempts.'})
    _validate_source_fidelity(source,{'summary':'The report covers 30 days with 3 failed login attempts and no blocked attacks.'})


def test_short_labelled_metrics_are_not_discarded():
    from src.file_summaries.providers import _sentences, _depth_target
    source='Security score: 92\nFailed logins: 3\nBlocked attacks: 0\nMFA: 40%\nUploads: 12\nDownloads: 18'
    assert len(_sentences(source)) == 6
    assert _depth_target(source,'detailed') == 6
    assert _depth_target('One source fact is available.','detailed') == 1


def test_native_items_cannot_add_nested_bullets_to_the_requested_count():
    import json
    from src.file_summaries.providers import _parse_ollama_result, _format_result
    source='The synthetic report recorded 24 successful logins during the reporting period. The report is not an independent security audit.'
    raw={'key_points':['- The report recorded 24 successful logins.\n- The reporting period is covered.', '2. The report is not an independent security audit.']}
    options={'summary_length':'short','output_format':'bullet_points'}
    result=_format_result(_parse_ollama_result(json.dumps(raw),source,options),options)
    assert len(result['summary'].splitlines()) == 2
    assert all(line.startswith('- ') for line in result['summary'].splitlines())


def test_source_qualification_cannot_be_reversed():
    from src.file_summaries.providers import _validate_source_fidelity
    source='This report is not an independent security audit and does not prove that undetected attacks never occurred.'
    with pytest.raises(ProviderUnavailable):
        _validate_source_fidelity(source,{'summary':'This report is an independent security audit.'})
    _validate_source_fidelity(source,{'summary':'This report is not an independent security audit.'})


def test_model_cannot_reuse_the_entire_answer_for_different_depth(db, document, monkeypatch):
    from types import SimpleNamespace
    user, file, _ = document
    repeated='Project Cedar stores encrypted files and owners control reviewer permissions.'
    monkeypatch.setattr(service,'_run_provider',lambda *a,**k: ({'summary':repeated,'key_points':[]},SimpleNamespace(name='ollama',model_name='synthetic'),None))
    short,_=service.create_summary(db,file.id,user.id,SummaryCreate(summary_length='short'))
    service.process_summary(short.id);db.expire_all()
    standard,_=service.create_summary(db,file.id,user.id,SummaryCreate(summary_length='standard'))
    service.process_summary(standard.id);db.expire_all()
    assert standard.status == 'completed'
    assert standard.provider == 'extractive_fallback'
    assert standard.summary_text != short.summary_text
    assert 'repeated another length' in standard.warning_message
