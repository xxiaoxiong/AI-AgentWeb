from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class MessageRead(BaseModel):
    id: str
    session_id: str
    role: MessageRole
    content: str = Field(..., min_length=1)
    created_at: datetime
