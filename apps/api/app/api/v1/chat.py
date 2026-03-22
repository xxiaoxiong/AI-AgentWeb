import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.schemas.chat import (
    AnswerCompletedPayload,
    ChatStreamRequest,
    RunFailedPayload,
    RunStartedPayload,
    SSEEvent,
    StageChangedPayload,
    TokenPayload,
)
from app.schemas.message import MessageRole
from app.schemas.run import RunStage, RunStatus
from app.services.in_memory_store import store
from app.services.mock_chat import build_mock_answer

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/stream")
async def chat_stream(payload: ChatStreamRequest) -> StreamingResponse:
    user_message = store.add_message(payload.session_id, MessageRole.USER, payload.message)
    if user_message is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    run = store.create_run(payload.session_id, payload.mode)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    async def event_generator() -> AsyncIterator[str]:
        try:
            yield encode_sse(
                SSEEvent(event="run_started", data=RunStartedPayload(run=run).model_dump(mode="json"))
            )

            current_run = store.update_run(run.id, stage=RunStage.BUILDING_CONTEXT)
            if current_run is not None:
                yield encode_sse(
                    SSEEvent(
                        event="stage_changed",
                        data=StageChangedPayload(run_id=run.id, stage=current_run.stage).model_dump(mode="json"),
                    )
                )

            await asyncio.sleep(0.05)
            current_run = store.update_run(run.id, stage=RunStage.SYNTHESIZING)
            if current_run is not None:
                yield encode_sse(
                    SSEEvent(
                        event="stage_changed",
                        data=StageChangedPayload(run_id=run.id, stage=current_run.stage).model_dump(mode="json"),
                    )
                )

            answer = build_mock_answer(payload.message, payload.mode)
            current_run = store.update_run(run.id, status=RunStatus.STREAMING, stage=RunStage.STREAMING)
            if current_run is not None:
                yield encode_sse(
                    SSEEvent(
                        event="stage_changed",
                        data=StageChangedPayload(run_id=run.id, stage=current_run.stage).model_dump(mode="json"),
                    )
                )

            for token in answer.split():
                await asyncio.sleep(0.02)
                yield encode_sse(
                    SSEEvent(
                        event="token",
                        data=TokenPayload(run_id=run.id, delta=f"{token} ").model_dump(mode="json"),
                    )
                )

            assistant_message = store.add_message(payload.session_id, MessageRole.ASSISTANT, answer)
            completed_run = store.update_run(run.id, status=RunStatus.DONE, stage=RunStage.DONE)
            if assistant_message is not None and completed_run is not None:
                yield encode_sse(
                    SSEEvent(
                        event="answer_completed",
                        data=AnswerCompletedPayload(
                            run_id=run.id,
                            message_id=assistant_message.id,
                            content=assistant_message.content,
                        ).model_dump(mode="json"),
                    )
                )
        except Exception as exc:  # noqa: BLE001
            store.update_run(run.id, status=RunStatus.FAILED, error=str(exc))
            yield encode_sse(
                SSEEvent(
                    event="run_failed",
                    data=RunFailedPayload(run_id=run.id, error=str(exc)).model_dump(mode="json"),
                )
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def encode_sse(event: SSEEvent) -> str:
    return f"event: {event.event}\ndata: {json.dumps(event.data, ensure_ascii=False)}\n\n"
