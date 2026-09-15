from uuid import uuid4

from src.analytics.constants import AnalyticsEventType
from src.analytics.models.analytics_event import AnalyticsEvent
from src.analytics.repository import AnalyticsRepository
from src.entities.file import File
from src.entities.notification import Notification
from src.entities.user import User
from src.files import service


def _file(db):
    suffix = uuid4().hex
    user = User(
        name="Download Metrics",
        email=f"download-metrics-{suffix}@test.com",
        hashed_password="not-used",
    )
    db.add(user)
    db.flush()
    file = File(
        original_name="metrics.txt",
        stored_name=f"download-metrics-{suffix}.txt",
        mimetype="text/plain",
        size=7,
        encrypted=False,
        owner_id=user.id,
    )
    db.add(file)
    db.commit()
    return user, file


def test_explicit_download_updates_file_and_analytics_metrics(db, monkeypatch):
    user, file = _file(db)
    monkeypatch.setattr(service, "load_encrypted_file", lambda _: b"metrics")

    content, name, mimetype = service.get_file_path(db, file.id, user.id)

    db.refresh(file)
    events = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.user_id == user.id,
        AnalyticsEvent.file_id == file.id,
        AnalyticsEvent.event_type == AnalyticsEventType.DOWNLOAD,
    ).all()
    assert (content, name, mimetype) == (b"metrics", "metrics.txt", "text/plain")
    assert file.download_count == 1
    assert file.last_downloaded_at is not None
    assert len(events) == 1
    notification = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.resource_id == file.id,
        Notification.type == "download",
    ).one()
    assert notification.title == "File downloaded"
    assert notification.category == "downloads"
    assert AnalyticsRepository().get_download_analytics(
        db, days=30, user_id=user.id
    )["total_downloads"] == 1


def test_preview_does_not_update_download_metrics(db, monkeypatch):
    user, file = _file(db)
    monkeypatch.setattr(service, "load_encrypted_file", lambda _: b"preview")

    service.get_file_path(db, file.id, user.id, record_download=False)

    db.refresh(file)
    assert file.download_count == 0
    assert db.query(AnalyticsEvent).filter(
        AnalyticsEvent.file_id == file.id,
        AnalyticsEvent.event_type == AnalyticsEventType.DOWNLOAD,
    ).count() == 0
    assert db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.resource_id == file.id,
        Notification.type == "download",
    ).count() == 0


def test_shared_download_does_not_duplicate_router_notification(db, monkeypatch):
    owner, file = _file(db)
    monkeypatch.setattr(service, "load_encrypted_file", lambda _: b"shared")

    service.get_file_path(
        db,
        file.id,
        owner.id,
        notification_user_id=owner.id + 1,
    )

    assert db.query(Notification).filter(
        Notification.user_id == owner.id,
        Notification.resource_id == file.id,
        Notification.type == "download",
    ).count() == 0
