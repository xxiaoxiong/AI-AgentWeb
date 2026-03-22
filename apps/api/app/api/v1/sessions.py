from fastapi import APIRouter, HTTPException, status

from app.schemas.session import SessionCreateRequest, SessionDetail, SessionRead
from app.services.in_memory_store import store

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(payload: SessionCreateRequest) -> SessionRead:
    return store.create_session(title=payload.title)


@router.get("", response_model=list[SessionRead])
def list_sessions() -> list[SessionRead]:
    return store.list_sessions()


@router.get("/{session_id}", response_model=SessionDetail)
def get_session(session_id: str) -> SessionDetail:
    session = store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session
