from uuid import uuid4

from src.api import app
from src.auth.dependencies import get_current_user
from src.entities.file import File
from src.entities.notification import Notification
from src.entities.share_link import ShareLink
from src.entities.user import User


def create_user(db, label):
    user = User(
        name=label,
        email=f"dashboard-api-{label.lower()}-{uuid4().hex}@test.com",
        hashed_password="not-used",
        storage_used=1_500,
        storage_quota=5_000,
    )
    db.add(user)
    db.flush()
    return user


def create_file(db, user, name, *, encrypted=True, deleted=False, size=100):
    file = File(
        original_name=name,
        stored_name=f"dashboard-api-{uuid4().hex}-{name}",
        mimetype="application/pdf",
        size=size,
        encrypted=encrypted,
        is_deleted=deleted,
        owner_id=user.id,
    )
    db.add(file)
    db.flush()
    return file


def authenticate_as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def test_dashboard_endpoint_requires_authentication(client):
    response = client.get("/api/dashboard/")

    assert response.status_code == 401


def test_authenticated_dashboard_returns_current_user_data_only(client, db):
    current_user = create_user(db, "Current")
    other_user = create_user(db, "Other")
    current_file = create_file(db, current_user, "current.pdf", size=1_500)
    current_file.download_count = 6
    other_file = create_file(db, other_user, "other.pdf", size=9_999)
    db.add_all(
        [
            ShareLink(
                file_id=current_file.id,
                token=f"dashboard-api-current-{uuid4().hex}",
                created_by=current_user.id,
                access_count=4,
                is_active=True,
            ),
            ShareLink(
                file_id=other_file.id,
                token=f"dashboard-api-other-{uuid4().hex}",
                created_by=other_user.id,
                access_count=12,
                is_active=True,
            ),
            Notification(
                user_id=current_user.id,
                type="upload",
                category="uploads",
                title="Current notification",
                message="Current user only",
                is_read=False,
            ),
            Notification(
                user_id=other_user.id,
                type="upload",
                category="uploads",
                title="Other notification",
                message="Other user only",
                is_read=False,
            ),
        ]
    )
    db.commit()
    authenticate_as(current_user)

    try:
        response = client.get("/api/dashboard/")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    data = response.json()
    assert data["analytics"]["total_files"] == 1
    assert data["analytics"]["encrypted_files"] == 1
    assert data["analytics"]["total_downloads"] == 6
    assert data["analytics"]["total_share_links"] == 1
    assert data["analytics"]["active_share_links"] == 1
    assert data["analytics"]["total_share_views"] == 4
    assert data["analytics"]["total_notifications"] == 1
    assert data["analytics"]["unread_notifications"] == 1
    assert data["analytics"]["storage"]["used_bytes"] == 1_500
    assert [file["original_name"] for file in data["files"]] == ["current.pdf"]
    assert [notification["title"] for notification in data["notifications"]] == [
        "Current notification"
    ]


def test_dashboard_endpoint_excludes_deleted_files_and_returns_expected_shape(client, db):
    user = create_user(db, "Deleted")
    create_file(db, user, "visible.pdf", encrypted=True)
    create_file(db, user, "deleted.pdf", encrypted=True, deleted=True)
    db.commit()
    authenticate_as(user)

    try:
        response = client.get("/api/dashboard/")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"analytics", "files", "notifications"}
    assert data["analytics"]["total_files"] == 1
    assert data["analytics"]["encrypted_files"] == 1
    assert data["analytics"]["storage"]["quota_bytes"] == 5_000
    assert [file["original_name"] for file in data["files"]] == ["visible.pdf"]
