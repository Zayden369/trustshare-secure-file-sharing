from src.database.core import Base, engine, SessionLocal
from src.security.seed.seed_config import seed_configs
from src.security.models.allowed_file_type import AllowedFileType
from src.security.seed.seed_allowed_file_types import seed_allowed_file_types
from src.security.models.app_config import AppConfig

# Import all entities so SQLAlchemy knows about them before create_all
from src.auth.registration import RegistrationChallenge, RegistrationLimit, VerifiedEmail  # noqa
from src.entities.user import User  # noqa
from src.entities.todo import Todo  # noqa
from src.entities.folder import Folder  # noqa
from src.entities.file import File  # noqa
from src.entities.share_link import ShareLink  # noqa
from src.entities.file_permission import FilePermission  # noqa
from src.entities.audit_log import AuditLog  # noqa
from src.entities.notification import Notification  # noqa
from src.entities.login_session import LoginSession  # noqa
from src.entities.file_summary import FileSummary  # noqa
from src.entities.file_content import FileContent  # noqa
from src.entities.notification_pref import NotificationPreference  # noqa
from src.entities.notification_channel_pref import NotificationChannelPreference  # noqa

# Import analytics models so tables are created
from src.analytics.models.analytics_event import AnalyticsEvent  # noqa
from src.analytics.models.analytics_config import AnalyticsConfig  # noqa
from src.analytics.models.event_type import AnalyticsEventType  # noqa
from src.analytics.models.event_status import AnalyticsEventStatus  # noqa
from src.analytics.models.severity_map import AnalyticsSeverityMap  # noqa

# Import AI Assistant models so tables are created
from src.entities.assistant_config import AssistantConfig  # noqa
from src.entities.assistant_function import AssistantFunction  # noqa
from src.entities.assistant_prompt import AssistantPrompt  # noqa
from src.entities.assistant_suggested_query import AssistantSuggestedQuery  # noqa
from src.entities.chat_conversation import ChatConversation  # noqa
from src.entities.chat_message import ChatMessage  # noqa
from src.entities.chat_turn import ChatTurn  # noqa

# Import analytics seeds
from src.analytics.seed import (
    seed_event_types,
    seed_event_statuses,
    seed_analytics_config,
    seed_severity_map,
)
from src.assistant.seed import seed_all_assistant_data


def init_db():
    """Create all tables and seed default configuration."""

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        # Security module seeds
        seed_configs(db)
        seed_allowed_file_types(db)

        # Analytics module seeds (auto-runs on every startup)
        # Uses UPSERT logic — safe to run repeatedly
        seed_event_types(db)
        seed_event_statuses(db)
        seed_analytics_config(db)
        seed_severity_map(db)

        # AI Assistant module seeds
        # Idempotent — only inserts missing rows
        seed_all_assistant_data(db)
    finally:
        db.close()
