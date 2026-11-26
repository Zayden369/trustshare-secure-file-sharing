import io

import pytest
from pptx import Presentation

from src.file_summaries import service
from src.file_summaries.models import SummaryCreate
from src.file_summaries.providers import ProviderUnavailable


def test_missing_document_has_actionable_error(monkeypatch):
    from types import SimpleNamespace
    from fastapi import HTTPException
    def missing(_):
        raise FileNotFoundError()
    monkeypatch.setattr(service, 'load_encrypted_file', missing)
    with pytest.raises(HTTPException) as error:
        service._load_plaintext(SimpleNamespace(stored_name='missing'))
    assert error.value.status_code == 404
    assert 'Upload the file again' in error.value.detail


def test_provider_setup_failure_uses_extraction(monkeypatch):
    monkeypatch.setenv('ENABLE_SUMMARY_FALLBACK', 'true')
    def unavailable():
        raise ProviderUnavailable('Not configured')
    monkeypatch.setattr(service, '_provider', unavailable)
    result, provider, warning = service._run_provider(
        'Documents are encrypted before storage. Sharing requires permission.',
        SummaryCreate().model_dump(),
    )
    assert provider.name == 'extractive_fallback'
    assert result['summary'] and warning


def test_powerpoint_summary_completes_without_ai(db, monkeypatch):
    from sqlalchemy.orm import sessionmaker
    from src.entities.user import User
    from src.entities.file import File
    from src.entities.file_summary import FileSummary
    deck = Presentation()
    slide = deck.slides.add_slide(deck.slide_layouts[1])
    slide.shapes.title.text = 'Synthetic project overview'
    slide.placeholders[1].text = 'Files are encrypted before storage. Permissions control secure sharing. Audit events record user actions.'
    content = io.BytesIO()
    deck.save(content)
    user = User(name='Summary recovery test', email='summary-recovery@example.test', hashed_password='unused')
    db.add(user); db.flush()
    file = File(original_name='synthetic.pptx', stored_name='synthetic-only', mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation', size=len(content.getvalue()), encrypted=False, owner_id=user.id, version=1)
    db.add(file); db.commit()
    summary, _ = service.create_summary(db, file.id, user.id, SummaryCreate())
    monkeypatch.setattr(service, 'SessionLocal', sessionmaker(bind=db.get_bind()))
    monkeypatch.setattr(service, '_load_plaintext', lambda _: content.getvalue())
    monkeypatch.setenv('ENABLE_SUMMARY_FALLBACK', 'true')
    def unavailable():
        raise ProviderUnavailable('Offline')
    monkeypatch.setattr(service, '_provider', unavailable)
    service.process_summary(summary.id)
    db.expire_all()
    saved = db.get(FileSummary, summary.id)
    assert saved.status == 'completed', saved.error_message
    assert saved.provider == 'extractive_fallback'
    assert 'encrypted' in saved.summary_text


def test_long_document_uses_one_model_request_and_preserves_full_text_fallback(db, monkeypatch):
    from sqlalchemy.orm import sessionmaker
    from src.entities.user import User
    from src.entities.file import File
    from src.entities.file_summary import FileSummary
    from src.file_summaries.providers import ExtractiveFallbackProvider

    user = User(name='Long summary test', email='summary-long@example.test', hashed_password='unused')
    db.add(user); db.flush()
    source = ('Opening states the project goal. ' * 150) + ('Middle records a distinct finding. ' * 150) + ('Ending states the final result. ' * 150)
    file = File(original_name='long.txt', stored_name='long-synthetic', mimetype='text/plain', size=len(source), encrypted=False, owner_id=user.id, version=1)
    db.add(file); db.commit()
    summary, _ = service.create_summary(db, file.id, user.id, SummaryCreate())
    monkeypatch.setattr(service, 'SessionLocal', sessionmaker(bind=db.get_bind()))
    monkeypatch.setattr(service, '_load_plaintext', lambda _: source.encode())
    seen = []
    provider = ExtractiveFallbackProvider()
    def generate(excerpt, options, fallback_text=None):
        seen.append((excerpt, fallback_text))
        return provider.generate_summary(fallback_text, options), provider, 'fallback'
    monkeypatch.setattr(service, '_run_provider', generate)
    service.process_summary(summary.id)
    db.expire_all()
    saved = db.get(FileSummary, summary.id)
    assert saved.status == 'completed', saved.error_message
    assert len(seen) == 1
    assert len(seen[0][0]) < len(source) and seen[0][1] == source.strip()
    assert 'excerpts' not in (saved.warning_message or '')
