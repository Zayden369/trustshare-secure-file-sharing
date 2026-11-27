from uuid import uuid4

import pytest

from src.api import app
from src.auth.dependencies import get_current_user
from src.entities.notification import Notification
from src.entities.user import User
from src.notifications.service import create_notification


def _user(db, label):
    user = User(
        name=label,
        email=f"notifications-{label.lower()}-{uuid4().hex}@test.com",
        hashed_password="not-used",
    )
    db.add(user)
    db.flush()
    return user


def _authenticate_as(user):
    app.dependency_overrides[get_current_user] = lambda: user


def test_create_notification_uses_callers_transaction(db):
    user = _user(db, "Create")

    notification = create_notification(
        db,
        user_id=user.id,
        type="upload",
        category="uploads",
        title="File uploaded",
        message='"report.pdf" was uploaded successfully.',
    )

    assert notification.id is not None
    assert db.query(Notification).filter_by(user_id=user.id).count() == 1
    db.rollback()
    assert db.query(Notification).filter_by(user_id=user.id).count() == 0


@pytest.mark.parametrize("icon", [None, "shield"])
@pytest.mark.parametrize("trailing_slash", ["", "/"])
def test_notification_api_lists_only_current_users_rows_and_marks_read(
    client, db, icon, trailing_slash
):
    current_user = _user(db, "Current")
    other_user = _user(db, "Other")
    current = Notification(
        user_id=current_user.id,
        type="security",
        category="security",
        title="New login to your account",
        message="Current user only",
        icon=icon,
        is_read=False,
    )
    db.add_all([
        current,
        Notification(
            user_id=other_user.id,
            type="upload",
            category="uploads",
            title="Other upload",
            message="Other user only",
            is_read=False,
        ),
    ])
    db.commit()
    _authenticate_as(current_user)

    try:
        response = client.get(f"/api/notifications{trailing_slash}")
        mark_response = client.patch(f"/api/notifications/{current.id}/read{trailing_slash}")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert [item["title"] for item in response.json()] == ["New login to your account"]
    assert response.json()[0]["icon"] == icon
    assert mark_response.status_code == 200
    assert mark_response.json()["is_read"] is True
    assert mark_response.json()["icon"] == icon


def test_notification_api_rejects_cross_user_update_and_delete(client, db):
    current_user = _user(db, "Owner")
    other_user = _user(db, "Target")
    other = Notification(
        user_id=other_user.id,
        type="share",
        category="shares",
        title="Private notification",
        message="Not yours",
        is_read=False,
    )
    db.add(other)
    db.commit()
    _authenticate_as(current_user)

    try:
        mark_response = client.patch(f"/api/notifications/{other.id}/read")
        delete_response = client.delete(f"/api/notifications/{other.id}")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert mark_response.status_code == 404
    assert delete_response.status_code == 404
    assert db.query(Notification).filter_by(id=other.id).one().is_read is False
