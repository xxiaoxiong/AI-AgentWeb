from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error: str = Field(..., description="Stable error code")
    message: str = Field(..., description="Human-readable error message")
    request_id: str | None = Field(default=None, description="Request correlation id")
