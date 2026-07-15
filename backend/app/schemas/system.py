"""
Esquemas Pydantic para System Info (issue #140, pieza C).
"""

from typing import List, Optional

from pydantic import BaseModel


class TopTable(BaseModel):
    name: str
    size_pretty: str
    size_bytes: int


class DbInfo(BaseModel):
    size_pretty: str
    top_tables: List[TopTable]


class MinioInfo(BaseModel):
    used_bytes: int


class Counts(BaseModel):
    model_files: int
    queue_items_done: int
    client_quotes: int
    spools: int


class MigrationsInfo(BaseModel):
    current: Optional[str]
    head: Optional[str]
    up_to_date: bool


class SystemInfoResponse(BaseModel):
    version: str
    uptime_seconds: float
    db: DbInfo
    minio: MinioInfo
    counts: Counts
    migrations: MigrationsInfo


class LogRow(BaseModel):
    ts: str
    level: str
    logger: str
    msg: str
