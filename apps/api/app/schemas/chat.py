from typing import Any

from pydantic import BaseModel, Field

from app.schemas.run import RunMode, RunRead, RunStage


class ChatStreamRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1, max_length=4000)
    mode: RunMode = RunMode.DEEP


class SSEEvent(BaseModel):
    event: str
    data: dict[str, Any]


class RunStartedPayload(BaseModel):
    run: RunRead


class StageChangedPayload(BaseModel):
    run_id: str
    stage: RunStage


class TokenPayload(BaseModel):
    run_id: str
    delta: str


class AnswerCompletedPayload(BaseModel):
    run_id: str
    message_id: str
    content: str


class RunFailedPayload(BaseModel):
    run_id: str
    error: str
