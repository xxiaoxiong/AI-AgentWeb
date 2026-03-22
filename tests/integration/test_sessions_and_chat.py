from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_session_create_list_and_detail() -> None:
    created = client.post("/api/v1/sessions", json={"title": "研究会话"})
    assert created.status_code == 201
    session = created.json()

    listing = client.get("/api/v1/sessions")
    assert listing.status_code == 200
    assert any(item["id"] == session["id"] for item in listing.json())

    detail = client.get(f"/api/v1/sessions/{session['id']}")
    assert detail.status_code == 200
    assert detail.json()["title"] == "研究会话"
    assert detail.json()["messages"] == []


def test_chat_stream_persists_messages_and_returns_sse_events() -> None:
    created = client.post("/api/v1/sessions", json={"title": "流式测试"})
    session_id = created.json()["id"]

    with client.stream(
        "POST",
        "/api/v1/chat/stream",
        json={"session_id": session_id, "message": "帮我研究 AI 搜索产品", "mode": "deep"},
    ) as response:
        assert response.status_code == 200
        body = "".join(response.iter_text())

    assert "event: run_started" in body
    assert "event: stage_changed" in body
    assert "event: token" in body
    assert "event: answer_completed" in body

    detail = client.get(f"/api/v1/sessions/{session_id}")
    payload = detail.json()
    assert len(payload["messages"]) == 2
    assert payload["messages"][0]["role"] == "user"
    assert payload["messages"][1]["role"] == "assistant"
