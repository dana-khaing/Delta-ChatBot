from __future__ import annotations

import base64
import binascii
import os
from typing import Any

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request, stream_with_context
from google import genai
from google.genai import types

load_dotenv()

PERSONAS = {
    "guide": (
        "You are Delta, a funny and quick-witted class-clown-style assistant who is "
        "still genuinely helpful. Use playful jokes, light teasing, surprising "
        "analogies, and energetic phrasing without being mean, distracting, or "
        "repetitive. Answer the question clearly before or alongside the humor. "
        "For serious, sensitive, or upsetting topics, drop the jokes and respond with "
        "care. Ask a useful follow-up question when context is missing."
    ),
    "python": (
        "You are Delta, an expert Python tutor. Explain concepts step by step, prefer "
        "small runnable examples, point out common mistakes, and never overwhelm beginners."
    ),
    "creative": (
        "You are Delta, a creative thinking partner. Help users explore several original "
        "directions, then turn the strongest direction into an actionable next step."
    ),
}

HUMOR_LEVELS = {
    "serious": "Use no jokes. Be direct, calm, and professional.",
    "funny": "Use occasional playful jokes while keeping the answer clear and useful.",
    "maximum": (
        "Turn the class-clown energy up high with frequent clever jokes, playful "
        "analogies, and dramatic phrasing, but never sacrifice accuracy or kindness."
    ),
}

ALLOWED_ATTACHMENT_TYPES = {
    "application/pdf",
    "text/markdown",
    "text/plain",
}
MAX_ATTACHMENTS = 2
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024


def system_instruction(persona: str, humor: str) -> str:
    return f"{PERSONAS[persona]} Humor setting: {HUMOR_LEVELS[humor]}"


def attachment_parts(raw_attachments: Any) -> list[types.Part]:
    if raw_attachments is None:
        return []
    if not isinstance(raw_attachments, list) or len(raw_attachments) > MAX_ATTACHMENTS:
        raise ValueError(f"Attach up to {MAX_ATTACHMENTS} files.")

    parts = []
    for attachment in raw_attachments:
        if not isinstance(attachment, dict):
            raise ValueError("Invalid attachment.")
        mime_type = str(attachment.get("mime_type", ""))
        encoded = str(attachment.get("data", ""))
        if not (mime_type.startswith("image/") or mime_type in ALLOWED_ATTACHMENT_TYPES):
            raise ValueError("Unsupported attachment type.")
        try:
            data = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Invalid attachment data.") from exc
        if not data or len(data) > MAX_ATTACHMENT_BYTES:
            raise ValueError("Each attachment must be 5 MB or smaller.")
        parts.append(types.Part.from_bytes(data=data, mime_type=mime_type))
    return parts


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(
        GEMINI_API_KEY=os.getenv("GEMINI_API_KEY", ""),
        GEMINI_MODEL=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        MAX_HISTORY_MESSAGES=20,
    )

    if test_config:
        app.config.update(test_config)

    @app.get("/")
    def index():
        return render_template("index.html", model=app.config["GEMINI_MODEL"])

    @app.get("/healthz")
    def health_check():
        return jsonify({"status": "ok", "service": "delta-chat"})

    @app.post("/api/chat")
    def chat():
        payload = request.get_json(silent=True) or {}
        message = str(payload.get("message", "")).strip()
        persona = str(payload.get("persona", "guide"))
        humor = str(payload.get("humor", "funny"))
        raw_history = payload.get("history", [])
        raw_attachments = payload.get("attachments", [])

        if not message and not raw_attachments:
            return jsonify({"error": "Please enter a message."}), 400
        if persona not in PERSONAS:
            return jsonify({"error": "Unknown assistant persona."}), 400
        if humor not in HUMOR_LEVELS:
            return jsonify({"error": "Unknown humor level."}), 400
        if not isinstance(raw_history, list):
            return jsonify({"error": "Conversation history must be a list."}), 400
        if not app.config["GEMINI_API_KEY"]:
            return jsonify(
                {"error": "GEMINI_API_KEY is not configured on the server."}
            ), 503
        try:
            files = attachment_parts(raw_attachments)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        history = []
        for item in raw_history[-app.config["MAX_HISTORY_MESSAGES"] :]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            text = str(item.get("text", "")).strip()
            if role in {"user", "model"} and text:
                history.append(
                    types.Content(role=role, parts=[types.Part.from_text(text=text)])
                )

        user_parts = [types.Part.from_text(text=message or "Analyze the attached files.")]
        history.append(types.Content(role="user", parts=user_parts + files))

        try:
            client = genai.Client(api_key=app.config["GEMINI_API_KEY"])
            response = client.models.generate_content(
                model=app.config["GEMINI_MODEL"],
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction(persona, humor),
                    temperature=0.7,
                ),
            )
            reply = (response.text or "").strip()
            if not reply:
                raise ValueError("Gemini returned an empty response.")
            return jsonify({"reply": reply})
        except Exception as exc:
            app.logger.exception("Gemini request failed")
            return jsonify({"error": f"Gemini request failed: {exc}"}), 502

    @app.post("/api/chat/stream")
    def stream_chat():
        payload = request.get_json(silent=True) or {}
        message = str(payload.get("message", "")).strip()
        persona = str(payload.get("persona", "guide"))
        humor = str(payload.get("humor", "funny"))
        raw_history = payload.get("history", [])
        raw_attachments = payload.get("attachments", [])

        if not message and not raw_attachments:
            return jsonify({"error": "Please enter a message."}), 400
        if persona not in PERSONAS:
            return jsonify({"error": "Unknown assistant persona."}), 400
        if humor not in HUMOR_LEVELS:
            return jsonify({"error": "Unknown humor level."}), 400
        if not isinstance(raw_history, list):
            return jsonify({"error": "Conversation history must be a list."}), 400
        if not app.config["GEMINI_API_KEY"]:
            return jsonify(
                {"error": "GEMINI_API_KEY is not configured on the server."}
            ), 503
        try:
            files = attachment_parts(raw_attachments)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        history = []
        for item in raw_history[-app.config["MAX_HISTORY_MESSAGES"] :]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            text = str(item.get("text", "")).strip()
            if role in {"user", "model"} and text:
                history.append(
                    types.Content(role=role, parts=[types.Part.from_text(text=text)])
                )
        user_parts = [types.Part.from_text(text=message or "Analyze the attached files.")]
        history.append(types.Content(role="user", parts=user_parts + files))

        try:
            client = genai.Client(api_key=app.config["GEMINI_API_KEY"])
            response_stream = client.models.generate_content_stream(
                model=app.config["GEMINI_MODEL"],
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction(persona, humor),
                    temperature=0.7,
                ),
            )
        except Exception as exc:
            app.logger.exception("Gemini streaming request failed")
            return jsonify({"error": f"Gemini request failed: {exc}"}), 502

        def generate():
            try:
                for chunk in response_stream:
                    if chunk.text:
                        yield chunk.text
            except Exception:
                app.logger.exception("Gemini stream failed")

        return Response(
            stream_with_context(generate()),
            mimetype="text/plain",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
