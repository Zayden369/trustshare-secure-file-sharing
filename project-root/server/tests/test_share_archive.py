from datetime import datetime, timedelta, timezone
import pytest
from fastapi import HTTPException
from src.shares.service import archive_share, list_shares, inspect_public_share
from src.entities.share_link import ShareLink, ShareLinkArchive
from src.entities.file import File
from src.entities.audit_log import AuditLog
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.database.core import Base
from src.database import init_db  # Registers the complete existing model graph.
from src.entities.user import User

@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as session:
        yield session
    engine.dispose()

def _public_share(db, *, token, is_active=True, expires_at=None):
    owner=User(name="Archive test",email=token+"@example.com",hashed_password="unused")
    db.add(owner); db.flush()
    file=File(original_name=token+".txt",stored_name=token+".txt",mimetype="text/plain",size=20,encrypted=False,hash_sha256="fixture",owner_id=owner.id)
    db.add(file); db.flush()
    share=ShareLink(file_id=file.id,token=token,created_by=owner.id,is_active=is_active,expires_at=expires_at)
    db.add(share); db.commit()
    return owner,file,share

def test_archival_preserves_file_and_history_and_survives_reload(db):
    owner, file, share = _public_share(db, token='archive-fixture', is_active=False)
    archive_share(db, share.id, owner.id)
    archive_share(db, share.id, owner.id)
    db.expire_all()
    assert all(row.id != share.id for row in list_shares(db, owner.id))
    assert db.get(File, file.id) is not None
    assert db.get(ShareLink, share.id) is not None
    assert db.get(ShareLinkArchive, share.id) is not None
    assert db.query(AuditLog).filter_by(resource_id=share.id, action='ARCHIVE_SHARE').count() == 1
    with pytest.raises(HTTPException) as error:
        inspect_public_share(db, share.token)
    assert error.value.status_code == 404

def test_archive_rejects_other_owners_and_active_links(db):
    owner, _, share = _public_share(db, token='archive-active')
    with pytest.raises(HTTPException) as error:
        archive_share(db, share.id, owner.id + 10000)
    assert error.value.status_code == 404
    with pytest.raises(HTTPException) as error:
        archive_share(db, share.id, owner.id)
    assert error.value.status_code == 409
    assert db.get(ShareLinkArchive, share.id) is None

def test_expired_link_becomes_inactive_before_archival(db):
    owner, _, share = _public_share(db, token='archive-expired', expires_at=datetime.now(timezone.utc)-timedelta(days=1))
    archive_share(db, share.id, owner.id)
    db.refresh(share)
    assert not share.is_active
