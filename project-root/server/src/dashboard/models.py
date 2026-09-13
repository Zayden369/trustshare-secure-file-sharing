from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StorageStats(BaseModel):
    used_bytes: int
    quota_bytes: int
    used_gb: float
    quota_gb: float
    percent: float


class UploadTrend(BaseModel):
    date: str
    count: int


class DashboardAnalytics(BaseModel):
    total_files: int
    encrypted_files: int
    total_downloads: int
    total_share_links: int
    active_share_links: int
    total_share_views: int
    total_notifications: int
    unread_notifications: int
    storage: StorageStats
    upload_trend: list[UploadTrend]
    top_file_types: dict[str, int]


class DashboardFile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_name: str
    mimetype: str
    size: int
    encrypted: bool
    created_at: datetime


class DashboardNotification(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    message: str
    is_read: bool
    created_at: datetime


class DashboardResponse(BaseModel):
    analytics: DashboardAnalytics
    files: list[DashboardFile]
    notifications: list[DashboardNotification]
