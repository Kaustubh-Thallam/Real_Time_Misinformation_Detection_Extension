<p align="center">
  <img src="extension/icons/icon128.png" alt="ClaimCheck Logo" width="80" />
</p>

<h1 align="center">ClaimCheck — Real-Time Misinformation Detection</h1>

<p align="center">
  <strong>Highlight any online claim → get an instant verdict, confidence score, and source links.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Features

- **Highlight-to-Verify** — Select any claim on any webpage, right-click → "Verify this claim"
- **Three-State Verdict** — Likely True · Needs Context · Likely False, with confidence %
- **Source-Backed** — Every verdict includes 2–3 source links from trusted databases
- **Popup + Side Panel** — Quick verdict in popup, full details (sources, explanation, feedback) in side panel
- **Privacy-First** — Minimal permissions (`activeTab` only), no browsing history stored, claim text never persisted
- **System Theme** — Automatically matches your OS light/dark preference
- **Rate-Limited Free Tier** — 50 checks/day free, with upgrade path

## How It Works

```
User highlights text → Context menu "Verify this claim"
                              │
                    ┌─────────▼──────────┐
                    │  Stage 1: Is this   │
                    │  a checkable claim? │  ← fast keyword heuristic
                    └─────────┬──────────┘
                              │ yes
                    ┌─────────▼──────────┐
                    │  Stage 2: Retrieve  │
                    │  from trusted       │  ← Wikipedia, Google Fact Check,
                    │  sources            │    PubMed APIs
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Stage 3: LLM       │
                    │  synthesizes verdict│  ← Ollama (Llama 3 / Mistral)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Verdict + Sources  │
                    │  returned to user   │  ← cached 24h in Redis
                    └─────────────────────┘
```

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Python** | 3.10+ | Backend |
| **PostgreSQL** | 14+ | User accounts, refresh tokens |
| **Redis** | 7+ | Claim cache, rate limiting, quota |
| **Ollama** | latest | Local LLM inference |
| **Chrome** | 116+ | Extension requires Manifest V3 + Side Panel API |

### 1. Clone the repo

```bash
git clone https://github.com/Kaustubh-Thallam/Real_Time_Misinformation_Detection_Extension.git
cd Real_Time_Misinformation_Detection_Extension
```

### 2. Set up the backend

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your actual values (see Environment Variables below)

# Run the server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`. Check health at `http://localhost:8000/api/health`.

### 3. Set up Ollama (LLM)

```bash
# Install Ollama: https://ollama.com/download
# Then pull a model:
ollama pull llama3.1:8b

# Ollama runs at http://localhost:11434 by default
```

### 4. Set up the database

```bash
# Create a PostgreSQL database
createdb claimcheck

# Tables are auto-created on first backend startup via SQLAlchemy
```

### 5. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. The ClaimCheck icon appears in your toolbar

### 6. Run tests

```bash
cd backend
pip install pytest
pytest tests/ -v
```

```
============================= 13 passed in 3.19s ==============================
```

### Environment Variables

Create `backend/.env` from `.env.example`:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ | 256-bit hex string for JWT signing |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (`postgresql+asyncpg://user:pass@localhost:5432/claimcheck`) |
| `REDIS_URL` | ✅ | Redis connection string (`redis://localhost:6379/0`) |
| `OLLAMA_URL` | ✅ | Ollama API URL (`http://localhost:11434`) |
| `OLLAMA_MODEL` | | Model name (default: `llama3.1:8b`) |
| `CORS_EXTENSION_ID` | ✅ | Your Chrome extension ID (find in `chrome://extensions`) |
| `GOOGLE_FACTCHECK_API_KEY` | | Google Fact Check Tools API key (optional, improves results) |
| `DAILY_CHECK_LIMIT` | | Checks per user per day (default: `50`) |

> **Generate a secret key:** `python -c "import secrets; print(secrets.token_hex(32))"`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Extension** | Chrome Manifest V3, vanilla JS, CSS custom properties |
| **Backend** | FastAPI (Python 3.10+), async |
| **Database** | PostgreSQL + SQLAlchemy (async) |
| **Cache** | Redis (24h TTL, SHA-256 keyed) |
| **LLM** | Ollama (Llama 3.1 8B / Mistral 7B) |
| **Auth** | JWT (15min access) + refresh token rotation (7 day, bcrypt-hashed) |
| **Sources** | Wikipedia API, Google Fact Check Tools API, PubMed E-utilities |
| **Rate Limiting** | slowapi (per-IP) + Redis (per-user quota) |

## Project Structure

```
├── extension/                  # Chrome MV3 extension
│   ├── manifest.json           # Permissions: activeTab, contextMenus, storage, sidePanel
│   ├── background.js           # Service worker — context menu + message relay
│   ├── content.js              # Content script — reports selected text
│   ├── shared.css              # Design tokens, system light/dark theme
│   ├── popup/
│   │   ├── popup.html          # Quick verdict + auth UI
│   │   ├── popup.css
│   │   └── popup.js            # Auth flow, verify, token refresh
│   ├── sidepanel/
│   │   ├── sidepanel.html      # Full detail — sources, accordion, feedback
│   │   ├── sidepanel.css
│   │   └── sidepanel.js        # Live updates, feedback submission
│   └── icons/
│
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # CORS, HSTS, rate limiting, error handler
│   │   ├── config.py           # Settings from env vars
│   │   ├── database.py         # Async SQLAlchemy engine
│   │   ├── models.py           # User + RefreshToken tables
│   │   ├── auth.py             # JWT + bcrypt + get_current_user
│   │   └── routes/
│   │       ├── auth.py         # Register, login, refresh, logout
│   │       └── verify.py       # Two-stage pipeline, Redis cache, quota
│   ├── tests/
│   │   └── test_core.py        # 13 unit tests
│   ├── requirements.txt
│   └── .env.example
│
├── misinformation-extension-prd.md   # Product requirements document
└── README.md
```

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/register` | — | Create account → `{ access_token, refresh_token }` |
| `POST` | `/api/v1/auth/login` | — | Sign in → `{ access_token, refresh_token }` |
| `POST` | `/api/v1/auth/refresh` | — | Rotate refresh token → new token pair |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke refresh token |
| `POST` | `/api/v1/verify` | Bearer | Verify a claim → `{ verdict, confidence, explanation, sources }` |
| `POST` | `/api/v1/feedback` | Bearer | Submit helpful/not_helpful feedback |
| `GET` | `/api/v1/usage` | Bearer | Check daily usage → `{ checks_today, daily_limit, tier }` |
| `GET` | `/api/health` | — | Health check → `{ status: "ok" }` |

## Security

- **CSP** on all extension HTML — `script-src 'self'; object-src 'none'`
- **CORS** locked to `chrome-extension://{YOUR_ID}` — no wildcard
- **JWT** 15-minute access tokens, HS256 signed
- **Refresh token rotation** — old token revoked on each refresh, SHA-256 hashed in DB
- **Input sanitization** — HTML stripped, whitespace normalized, 2000 char max
- **HSTS** + `X-Content-Type-Options: nosniff` + `X-Frame-Options: DENY`
- **No PII in logs** — user IDs hashed, claim text never logged
- **Rate limiting** — 10 req/min per IP (slowapi), 50 checks/day per user (Redis)

## Roadmap

| Phase | Status | Goal |
|-------|--------|------|
| **Phase 1** | ✅ Done | Core V1 — highlight-to-check, 3-state verdict, source links, FastAPI, auth |
| **Phase 2** | 🔜 Next | Better explanations, feedback loop analytics, privacy page, source quality ranking |
| **Phase 3** | Planned | More sites, transcript support, optional auto-detect suggestions |
| **Phase 4** | Planned | Multimodal verification (images, deepfakes) after quality validation |

## Contributing

1. Fork the repo
2. Create a feature branch from `dev` (`git checkout -b feature/my-feature dev`)
3. Write tests for new functionality
4. Ensure all tests pass (`pytest tests/ -v`)
5. Submit a PR against `dev`

## License

MIT

---

<p align="center">
  Built with ❤️ for a more informed internet.
</p>
