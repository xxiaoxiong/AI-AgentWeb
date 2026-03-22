from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from threading import Lock
from uuid import uuid4

from app.schemas.message import MessageRead, MessageRole
from app.schemas.run import RunMode, RunRead, RunStage, RunStatus
from app.schemas.session import SessionDetail, SessionRead


@dataclass(slots=True)
class SessionRecord:
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_ids: list[str] = field(default_factory=list)


@dataclass(slots=True)
class MessageRecord:
    id: str
    session_id: str
    role: MessageRole
    content: str
    created_at: datetime


@dataclass(slots=True)
class RunRecord:
    id: str
    session_id: str
    mode: RunMode
    status: RunStatus
    stage: RunStage
    error: str | None
    created_at: datetime
    updated_at: datetime


class InMemoryStore:
    def __init__(self) -> None:
        self._lock = Lock()
        self._sessions: dict[str, SessionRecord] = {}
        self._messages: dict[str, MessageRecord] = {}
        self._runs: dict[str, RunRecord] = {}

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    def create_session(self, title: str) -> SessionRead:
        with self._lock:
            now = self._now()
            session = SessionRecord(id=str(uuid4()), title=title, created_at=now, updated_at=now)
            self._sessions[session.id] = session
            return self._to_session_read(session)

    def list_sessions(self) -> list[SessionRead]:
        with self._lock:
            sessions = sorted(self._sessions.values(), key=lambda item: item.updated_at, reverse=True)
            return [self._to_session_read(item) for item in sessions]

    def get_session(self, session_id: str) -> SessionDetail | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None
            messages = [self._to_message_read(self._messages[message_id]) for message_id in session.message_ids]
            payload = self._to_session_read(session)
            return SessionDetail(**payload.model_dump(), messages=messages)

    def add_message(self, session_id: str, role: MessageRole, content: str) -> MessageRead | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None

            now = self._now()
            message = MessageRecord(
                id=str(uuid4()),
                session_id=session_id,
                role=role,
                content=content,
                created_at=now,
            )
            self._messages[message.id] = message
            session.message_ids.append(message.id)
            session.updated_at = now
            return self._to_message_read(message)

    def create_run(self, session_id: str, mode: RunMode) -> RunRead | None:
        with self._lock:
            if session_id not in self._sessions:
                return None

            now = self._now()
            run = RunRecord(
                id=str(uuid4()),
                session_id=session_id,
                mode=mode,
                status=RunStatus.QUEUED,
                stage=RunStage.ROUTING,
                error=None,
                created_at=now,
                updated_at=now,
            )
            self._runs[run.id] = run
            return self._to_run_read(run)

    def update_run(
        self,
        run_id: str,
        *,
        status: RunStatus | None = None,
        stage: RunStage | None = None,
        error: str | None = None,
    ) -> RunRead | None:
        with self._lock:
            run = self._runs.get(run_id)
            if run is None:
                return None

            if status is not None:
                run.status = status
            if stage is not None:
                run.stage = stage
            if error is not None:
                run.error = error
            run.updated_at = self._now()
            return self._to_run_read(run)

    @staticmethod
    def _to_session_read(session: SessionRecord) -> SessionRead:
        return SessionRead(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=len(session.message_ids),
        )

    @staticmethod
    def _to_message_read(message: MessageRecord) -> MessageRead:
        return MessageRead(
            id=message.id,
            session_id=message.session_id,
            role=message.role,
            content=message.content,
            created_at=message.created_at,
        )

    @staticmethod
    def _to_run_read(run: RunRecord) -> RunRead:
        return RunRead(
            id=run.id,
            session_id=run.session_id,
            mode=run.mode,
            status=run.status,
            stage=run.stage,
            error=run.error,
            created_at=run.created_at,
            updated_at=run.updated_at,
        )


store = InMemoryStore()
