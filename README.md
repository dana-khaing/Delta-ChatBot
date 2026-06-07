<div align="center">

![Header](https://capsule-render.vercel.app/api?type=waving&color=0:101427,45:342c72,100:6755e7&height=220&section=header&text=Delta%20Chat&fontSize=48&fontColor=ffffff&fontAlignY=38&desc=A%20Focused%20Gemini-Powered%20Chatbot&descAlignY=58&descColor=d8d3ff&animation=fadeIn)

[![Status](https://img.shields.io/badge/Status-Development-342c72?style=for-the-badge)](https://github.com/dana-khaing/Delta-ChatBot)
[![Python](https://img.shields.io/badge/Python-3.9%2B-101427?style=for-the-badge&logo=python&logoColor=d8d3ff)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-1a2038?style=for-the-badge&logo=flask&logoColor=ffffff)](https://flask.palletsprojects.com/)
[![Gemini](https://img.shields.io/badge/AI-Gemini-6755e7?style=for-the-badge&logo=googlegemini&logoColor=ffffff)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-101427?style=for-the-badge)](./LICENSE)

[![Repository](https://img.shields.io/badge/GitHub-Delta_Chat-171a26?style=for-the-badge&logo=github&logoColor=ffffff)](https://github.com/dana-khaing/Delta-ChatBot)
[![Tests](https://img.shields.io/github/actions/workflow/status/dana-khaing/Delta-ChatBot/tests.yml?style=for-the-badge&label=Tests)](https://github.com/dana-khaing/Delta-ChatBot/actions)

</div>

## About Delta Chat

Delta Chat is a focused browser-based AI assistant powered by Google's Gemini
API. It combines a lightweight Python and Flask backend with a responsive chat
interface, configurable assistant personas, and multi-turn conversation
history.

The project takes inspiration from Dataquest's Python chatbot walkthrough and
turns its core ideas into a polished, testable web application.

## Project Snapshot

- Status: active development
- Interface: responsive browser chat application
- AI provider: Google Gemini
- Default model: `gemini-2.5-flash`
- Backend: Python with Flask
- License: proprietary, all rights reserved

## Core Highlights

- Three selectable assistant personas
- Multi-turn conversation history
- Server-side Gemini API calls
- Responsive desktop and mobile interface
- Suggested prompts and clear-chat workflow
- Isolated environment configuration
- Automated API tests with a mocked Gemini client
- Deployment-ready health endpoint

## Assistant Personas

### Class Clown

A funny, quick-witted general-purpose assistant that gives useful answers with
playful jokes and light mischief, while dropping the humor for serious topics.

### Python Tutor

A learning-focused assistant that explains Python concepts step by step,
prefers small runnable examples, and highlights common mistakes.

### Creative Partner

An idea-development assistant that explores multiple directions and turns the
strongest option into an actionable next step.

## Tech Stack

### Application

![Python](https://img.shields.io/badge/Python-342c72?style=flat-square&logo=python&logoColor=ffffff)
![Flask](https://img.shields.io/badge/Flask-101427?style=flat-square&logo=flask&logoColor=ffffff)
![Gemini](https://img.shields.io/badge/Google_Gemini-6755e7?style=flat-square&logo=googlegemini&logoColor=ffffff)

### Interface And Testing

![HTML](https://img.shields.io/badge/HTML5-342c72?style=flat-square&logo=html5&logoColor=ffffff)
![CSS](https://img.shields.io/badge/CSS3-101427?style=flat-square&logo=css3&logoColor=ffffff)
![JavaScript](https://img.shields.io/badge/JavaScript-6755e7?style=flat-square&logo=javascript&logoColor=ffffff)
![Pytest](https://img.shields.io/badge/Pytest-1a2038?style=flat-square&logo=pytest&logoColor=ffffff)

## Architecture

```text
Browser interface
      |
      | JSON over HTTP
      v
Flask application
      |
      | Server-side authenticated request
      v
Google Gemini API
```

Conversation history is maintained in the browser and sent with each request.
The Flask server validates and limits that history before calling Gemini. The
API key remains exclusively on the server.

## Project Structure

```text
Delta-ChatBot/
├── .github/workflows/     GitHub Actions
├── static/                Browser styles and behavior
├── templates/             Flask HTML templates
├── tests/                 API tests
├── app.py                 Flask app and Gemini integration
├── pyproject.toml         Pytest configuration
├── render.yaml            Render deployment blueprint
└── requirements.txt       Python dependencies
```

## Local Development

### Requirements

- Python 3.9 or newer
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Install And Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a local `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Start the development server:

```bash
flask --app app run --debug
```

Open:

```text
http://127.0.0.1:5000
```

## Testing

Run the complete test suite:

```bash
pytest
```

The tests cover the home page, health endpoint, request validation, missing
configuration, and a successful mocked Gemini response.

## API

### Chat

`POST /api/chat`

```json
{
  "message": "Explain list comprehensions",
  "persona": "python",
  "history": []
}
```

The server accepts `guide`, `python`, or `creative` as persona values and limits
requests to the latest 20 history messages.

### Health Check

`GET /healthz`

```json
{
  "service": "delta-chat",
  "status": "ok"
}
```

## Deployment

The included `render.yaml` configures a Render web service with:

- Python `3.11.11`
- Gunicorn production server
- `/healthz` health check
- secret `GEMINI_API_KEY` environment variable

After creating the service, set `GEMINI_API_KEY` in the Render dashboard.

## Security

- Never commit `.env` or API keys.
- Keep Gemini requests on the server.
- Rotate any key that is exposed in screenshots, logs, or source control.
- Use a restricted production key where supported.

## Reference

- [Build an AI Chatbot with Python - Dataquest](https://www.youtube.com/watch?v=9REJ66cRlCM)
- [Google Gen AI Python SDK](https://googleapis.github.io/python-genai/)
- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
