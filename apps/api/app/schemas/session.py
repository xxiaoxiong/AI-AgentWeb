from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.message import MessageRead


class SessionCreateRequest(BaseModel):
    title: str = Field(default="新对话", min_length=1, max_length=120)


class SessionRead(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class SessionDetail(SessionRead):
    messages: list[MessageRead]
