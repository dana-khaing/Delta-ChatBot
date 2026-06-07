# Delta Chat

A focused Gemini-powered chatbot built with Python and Flask. It follows the
core ideas from Dataquest's chatbot walkthrough: configurable personas,
conversation history, server-side API calls, and a clean browser interface.

## Features

- Three selectable assistant personas
- Multi-turn conversation history
- Responsive desktop and mobile interface
- Gemini API key kept on the Python server
- Focused API tests with a mocked Gemini client

## Run locally

1. Create a virtual environment and install dependencies:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your Gemini API key to `.env`, then start the app:

   ```bash
   flask --app app run --debug
   ```

4. Open <http://127.0.0.1:5000>.

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).

## Test

```bash
pytest
```

## Project structure

```text
app.py                 Flask app and Gemini integration
templates/index.html   Chat interface
static/                Browser styles and behavior
tests/                 API tests
```

## API

`POST /api/chat`

```json
{
  "message": "Explain list comprehensions",
  "persona": "python",
  "history": []
}
```

The server limits the request to the latest 20 history messages before calling
Gemini.
