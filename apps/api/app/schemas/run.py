from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class RunMode(StrEnum):
    FAST = "fast"
    DEEP = "deep"
    BACKGROUND = "background"


class RunStatus(StrEnum):
    QUEUED = "queued"
    STREAMING = "streaming"
    DONE = "done"
    FAILED = "failed"


class RunStage(StrEnum):
    ROUTING = "routing"
    BUILDING_CONTEXT = "building_context"
    SYNTHESIZING = "synthesizing"
    STREAMING = "streaming"
    DONE = "done"


class RunRead(BaseModel):
    id: str
    session_id: str
    mode: RunMode
    status: RunStatus
    stage: RunStage
    error: str | None
    created_at: datetime
    updated_at: datetime
