from __future__ import annotations

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
        raw_history = payload.get("history", [])

        if not message:
            return jsonify({"error": "Please enter a message."}), 400
        if persona not in PERSONAS:
            return jsonify({"error": "Unknown assistant persona."}), 400
        if not isinstance(raw_history, list):
            return jsonify({"error": "Conversation history must be a list."}), 400
        if not app.config["GEMINI_API_KEY"]:
            return jsonify(
                {"error": "GEMINI_API_KEY is not configured on the server."}
            ), 503

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

        history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )

        try:
            client = genai.Client(api_key=app.config["GEMINI_API_KEY"])
            response = client.models.generate_content(
                model=app.config["GEMINI_MODEL"],
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=PERSONAS[persona],
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
        raw_history = payload.get("history", [])

        if not message:
            return jsonify({"error": "Please enter a message."}), 400
        if persona not in PERSONAS:
            return jsonify({"error": "Unknown assistant persona."}), 400
        if not isinstance(raw_history, list):
            return jsonify({"error": "Conversation history must be a list."}), 400
        if not app.config["GEMINI_API_KEY"]:
            return jsonify(
                {"error": "GEMINI_API_KEY is not configured on the server."}
            ), 503

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
        history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=message)])
        )

        try:
            client = genai.Client(api_key=app.config["GEMINI_API_KEY"])
            response_stream = client.models.generate_content_stream(
                model=app.config["GEMINI_MODEL"],
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=PERSONAS[persona],
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
