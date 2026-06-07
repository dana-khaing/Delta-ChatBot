import base64
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app import create_app


@pytest.fixture()
def client():
    app = create_app({"TESTING": True, "GEMINI_API_KEY": "test-key"})
    return app.test_client()


def test_home_page(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"Delta Chat" in response.data
    assert b"static/app.js" in response.data


def test_health_check(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json == {"status": "ok", "service": "delta-chat"}


def test_chat_requires_message(client):
    response = client.post("/api/chat", json={"message": "  "})
    assert response.status_code == 400
    assert response.json["error"] == "Please enter a message."


def test_chat_rejects_unknown_persona(client):
    response = client.post(
        "/api/chat", json={"message": "Hello", "persona": "villain"}
    )
    assert response.status_code == 400


def test_chat_returns_gemini_reply(client):
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = SimpleNamespace(
        text="Hello from Gemini"
    )

    with patch("app.genai.Client", return_value=mock_client):
        response = client.post(
            "/api/chat",
            json={
                "message": "Hello",
                "persona": "guide",
                "humor": "maximum",
                "history": [{"role": "user", "text": "Earlier question"}],
            },
        )

    assert response.status_code == 200
    assert response.json == {"reply": "Hello from Gemini"}
    mock_client.models.generate_content.assert_called_once()
    config = mock_client.models.generate_content.call_args.kwargs["config"]
    assert "class-clown-style assistant" in config.system_instruction
    assert "Turn the class-clown energy up high" in config.system_instruction


def test_chat_reports_missing_api_key():
    app = create_app({"TESTING": True, "GEMINI_API_KEY": ""})
    response = app.test_client().post("/api/chat", json={"message": "Hello"})
    assert response.status_code == 503


def test_chat_rejects_unknown_humor_level(client):
    response = client.post(
        "/api/chat", json={"message": "Hello", "humor": "chaos"}
    )
    assert response.status_code == 400
    assert response.json["error"] == "Unknown humor level."


def test_chat_stream_returns_incremental_reply(client):
    mock_client = MagicMock()
    mock_client.models.generate_content_stream.return_value = [
        SimpleNamespace(text="Hello "),
        SimpleNamespace(text="from Gemini"),
    ]

    with patch("app.genai.Client", return_value=mock_client):
        response = client.post(
            "/api/chat/stream",
            json={"message": "Hello", "persona": "guide", "history": []},
        )

    assert response.status_code == 200
    assert response.text == "Hello from Gemini"
    assert response.headers["Cache-Control"] == "no-cache"


def test_chat_accepts_image_attachment(client):
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = SimpleNamespace(text="Image seen")

    with patch("app.genai.Client", return_value=mock_client):
        response = client.post(
            "/api/chat",
            json={
                "message": "What is this?",
                "attachments": [
                    {
                        "mime_type": "image/png",
                        "data": base64.b64encode(b"image-bytes").decode(),
                    }
                ],
            },
        )

    assert response.status_code == 200
    contents = mock_client.models.generate_content.call_args.kwargs["contents"]
    assert len(contents[-1].parts) == 2


def test_chat_rejects_unsupported_attachment(client):
    response = client.post(
        "/api/chat",
        json={
            "attachments": [
                {
                    "mime_type": "application/zip",
                    "data": base64.b64encode(b"zip").decode(),
                }
            ]
        },
    )
    assert response.status_code == 400
    assert response.json["error"] == "Unsupported attachment type."
