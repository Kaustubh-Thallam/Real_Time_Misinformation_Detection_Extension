# ClaimCheck — Real-Time Misinformation Detection Extension

Highlight any online claim → get instant verdict, confidence %, and source links.

## Structure

```
extension/     Chrome MV3 extension (popup + side panel)
backend/       FastAPI backend (auth, verification pipeline, Redis cache)
```

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # fill in real values
uvicorn app.main:app --reload
```

### Extension
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" → select the `extension/` folder

### Tests
```bash
cd backend
pytest tests/ -v
```

## Tech Stack
- **Extension:** Chrome Manifest V3, vanilla JS
- **Backend:** FastAPI, SQLAlchemy (async), Redis, Ollama
- **Auth:** JWT (15min) + refresh token rotation
- **Sources:** Wikipedia, Google Fact Check Tools API, PubMed
