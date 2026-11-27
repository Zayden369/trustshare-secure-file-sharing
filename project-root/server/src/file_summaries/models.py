from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

SummaryLength = Literal["short", "standard", "detailed"]
OutputLanguage = Literal["original"]
OutputFormat = Literal["paragraph", "bullet_points"]


class SummaryCreate(BaseModel):
    file_version_id: Optional[int] = None
    summary_length: SummaryLength = "standard"
    output_language: OutputLanguage = "original"
    output_format: OutputFormat = "paragraph"
    force_regenerate: bool = False


class SummaryOut(BaseModel):
    id: int
    file_id: int
    file_version_id: Optional[int]
    source_file_version: int
    requested_by_user_id: int
    status: str
    summary_length: str
    output_language: str
    output_format: str
    title: Optional[str]
    summary_text: Optional[str]
    key_points: list[str]
    keywords: list[str]
    provider: Optional[str]
    model_name: Optional[str]
    source_checksum: str
    extracted_character_count: int
    processing_time_ms: Optional[int]
    warning_message: Optional[str]
    error_message: Optional[str]
    generated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    cached: bool = False
    stage: Optional[str] = None
    performance: Optional[dict] = None
    generation_policy: Optional[str] = None
    generation_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SummaryList(BaseModel):
    summaries: list[SummaryOut]
    total: int
