<p align="center">
  <img src="extension/icons/icon128.png" alt="ClaimCheck Logo" width="100" />
</p>

<h1 align="center">🛡️ ClaimCheck — Real-Time Misinformation Detection Browser Extension</h1>

<p align="center">
  <em>Highlight any online claim. Get an instant verdict, confidence score, and source links — without leaving the page.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome MV3" />
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Ollama-LLM-000000?style=for-the-badge" alt="Ollama" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-13%20passed-brightgreen?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/security-hardened-blue?style=flat-square" alt="Security" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/github/last-commit/Kaustubh-Thallam/Real_Time_Misinformation_Detection_Extension?style=flat-square" alt="Last Commit" />
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-security">Security</a> •
  <a href="#-roadmap">Roadmap</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 📌 Problem Statement

Users encounter questionable claims daily on social media, news sites, and search results. Manually verifying each claim creates friction, interrupts browsing, and most people simply don't bother. Existing fact-checking tools often require leaving the page, produce confusing outputs, or demand too many permissions — eroding trust before delivering value.

**ClaimCheck solves this** by bringing fact-checking directly into the browsing experience — one highlight, one click, one verdict.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Highlight-to-Verify** | Select any claim on any webpage → right-click → "Verify this claim" |
| 📊 **Three-State Verdict** | **Likely True** · **Needs Context** · **Likely False** — with confidence percentage |
| 📚 **Source-Backed Results** | Every verdict includes 2–3 source links from Wikipedia, Google Fact Check, and PubMed |
| 💬 **Popup + Side Panel** | Quick verdict in toolbar popup; full details (sources, explanation, feedback) in side panel |
| 🔒 **Privacy-First Design** | Minimal permissions (`activeTab` only), no browsing history stored, claim text never persisted |
| 🌗 **System Theme Support** | Automatically adapts to your OS light/dark mode preference |
| ⚡ **Two-Stage Pipeline** | Fast claim-worthiness check → deep verification only when needed |
| 🗄️ **Smart Caching** | Results cached 24 hours in Redis — repeat lookups return instantly |
| 👤 **User Auth + Quota** | JWT authentication with 50 free checks/day per user |
| 👍 **Feedback Loop** | Thumbs up/down on every result to improve quality over time |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER (Chrome MV3)                       │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │ Content      │  │ Popup       │  │ Side Panel           │ │
│  │ Script       │  │ (Quick      │  │ (Full Details)       │ │
│  │ (Selection)  │  │  Verdict)   │  │ • Sources            │ │
│  └──────┬───────┘  └──────┬──────┘  │ • Explanation        │ │
│         │                 │         │ • Feedback            │ │
│         └────────┬────────┘         └──────────┬───────────┘ │
│                  │                             │             │
│           ┌──────▼─────────────────────────────▼───┐         │
│           │       Background Service Worker         │         │
│           │     (Context Menu + Message Relay)      │         │
│           └──────────────────┬──────────────────────┘         │
└──────────────────────────────┼────────────────────────────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │   FastAPI Backend    │
                    │   (Render.com)       │
                    ├─────────────────────┤
                    │                     │
                    │  ┌───────────────┐  │
                    │  │ Auth Service  │  │    ┌─────────────┐
                    │  │ JWT + Refresh │──┼───►│ PostgreSQL  │
                    │  │ Token Rotation│  │    │ Users, Tokens│
                    │  └───────────────┘  │    └─────────────┘
                    │                     │
                    │  ┌───────────────┐  │    ┌─────────────┐
                    │  │ Verification  │  │    │   Redis     │
                    │  │ Pipeline      │──┼───►│ Cache +     │
                    │  │ Two-Stage     │  │    │ Quota       │
                    │  └───────┬───────┘  │    └─────────────┘
                    │          │          │
                    └──────────┼──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───┐   ┌───────▼──────┐  ┌──────▼──────┐
     │ Wikipedia  │   │ Google Fact  │  │   Ollama    │
     │ API        │   │ Check API    │  │ (Llama 3.1) │
     └────────────┘   └──────────────┘  └─────────────┘
```

---

## 🔄 How It Works

### User Flow
1. **Highlight** any claim on a webpage
2. **Right-click** → "Verify this claim" (or click the toolbar icon)
3. **Instant result** appears in popup with verdict + confidence %
4. **Expand** to side panel for sources, detailed explanation, and feedback

### Verification Pipeline

```
Input: "COVID vaccines cause autism"
         │
         ▼
┌─────────────────────────────────────┐
│ STAGE 1: Claim-Worthiness Check     │  ~10ms
│ • Keyword heuristic scoring         │
│ • Filters greetings, URLs, gibberish│
│ • Result: checkworthy=true, score=0.8│
└────────────────┬────────────────────┘
                 │ checkworthy? → yes
                 ▼
┌─────────────────────────────────────┐
│ STAGE 2: Source Retrieval           │  ~1-2s
│ • Wikipedia API search              │
│ • Google Fact Check Tools API       │
│ • PubMed E-utilities (science)      │
│ • Returns top 3 relevant sources    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ STAGE 3: LLM Synthesis             │  ~1-3s
│ • Ollama (Llama 3.1 8B)            │
│ • Prompt: claim + source snippets   │
│ • Output: verdict, confidence %,    │
│   plain-language explanation        │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│ OUTPUT                              │
│ verdict: "likely_false"             │
│ confidence: 96%                     │
│ explanation: "Multiple large-scale  │
│   studies found no link between     │
│   vaccines and autism."             │
│ sources: [Snopes, Wikipedia, PubMed]│
│                                     │
│ Cached in Redis for 24 hours        │
└─────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Install Guide |
|------|---------|---------------|
| **Python** | 3.10+ | [python.org](https://www.python.org/downloads/) |
| **PostgreSQL** | 14+ | [postgresql.org](https://www.postgresql.org/download/) |
| **Redis** | 7+ | Windows: [Memurai](https://www.memurai.com/) or `docker run -p 6379:6379 redis` |
| **Ollama** | latest | [ollama.com](https://ollama.com/download) |
| **Chrome** | 116+ | Required for Manifest V3 + Side Panel API |

### Step 1: Clone the Repository

```bash
git clone https://github.com/Kaustubh-Thallam/Real_Time_Misinformation_Detection_Extension.git
cd Real_Time_Misinformation_Detection_Extension
```

### Step 2: Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# ⚠️ Edit .env with your actual values — see Environment Variables table below
```

### Step 3: Database Setup

```bash
# Create PostgreSQL database
createdb claimcheck

# Tables auto-created on first server startup via SQLAlchemy
```

### Step 4: Start Ollama

```bash
# Pull a model (one-time)
ollama pull llama3.1:8b

# Ollama auto-starts at http://localhost:11434
```

### Step 5: Launch the Backend

```bash
cd backend
uvicorn app.main:app --reload
```

✅ Server running at `http://localhost:8000`  
✅ Health check: `http://localhost:8000/api/health`  
✅ API docs: `http://localhost:8000/docs`

### Step 6: Load the Chrome Extension

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle top-right)
3. Click **"Load unpacked"** → select the `extension/` folder
4. Copy the **Extension ID** shown under the extension name
5. Paste it into `backend/.env` as `CORS_EXTENSION_ID=<your-id>`
6. Restart the backend to apply CORS

### Step 7: Verify Installation

```bash
cd backend
pip install pytest
pytest tests/ -v
```

Expected output:
```
tests/test_core.py::test_password_hash_and_verify         PASSED
tests/test_core.py::test_access_token_roundtrip            PASSED
tests/test_core.py::test_access_token_expired              PASSED
tests/test_core.py::test_hash_token_deterministic          PASSED
tests/test_core.py::test_checkworthy_factual_claim         PASSED
tests/test_core.py::test_checkworthy_greeting_rejected     PASSED
tests/test_core.py::test_checkworthy_short_sentence        PASSED
tests/test_core.py::test_checkworthy_url_rejected          PASSED
tests/test_core.py::test_sanitize_strips_html              PASSED
tests/test_core.py::test_sanitize_max_length               PASSED
tests/test_core.py::test_sanitize_rejects_too_short        PASSED
tests/test_core.py::test_sanitize_normalizes_whitespace    PASSED
tests/test_core.py::test_cache_key_case_insensitive        PASSED

============================= 13 passed in 3.19s ==============================
```

### Environment Variables

Create `backend/.env` from the provided `.env.example`:

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `SECRET_KEY` | ✅ | — | JWT signing key. Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | ✅ | — | `postgresql+asyncpg://user:pass@localhost:5432/claimcheck` |
| `REDIS_URL` | ✅ | — | `redis://localhost:6379/0` |
| `OLLAMA_URL` | ✅ | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | | `llama3.1:8b` | LLM model name |
| `CORS_EXTENSION_ID` | ✅ | — | Your Chrome extension ID from `chrome://extensions` |
| `GOOGLE_FACTCHECK_API_KEY` | | — | [Google Cloud Console](https://console.cloud.google.com/) → enable Fact Check Tools API |
| `DAILY_CHECK_LIMIT` | | `50` | Max checks per user per day |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Extension** | Chrome Manifest V3, Vanilla JS | Native performance, no build step, maximum browser compatibility |
| **Styling** | CSS Custom Properties | System light/dark auto-detection, zero dependencies |
| **Backend** | FastAPI (async Python) | High-performance async API, auto-generated OpenAPI docs |
| **Database** | PostgreSQL + SQLAlchemy | Robust relational storage for users and auth tokens |
| **Cache** | Redis | Sub-millisecond lookups, TTL-based cache expiry, atomic quota counters |
| **LLM** | Ollama (Llama 3.1 / Mistral) | Self-hosted, zero API cost, full data privacy |
| **Auth** | JWT + bcrypt + Refresh Rotation | Industry-standard, 15-min access tokens, revocable refresh tokens |
| **Sources** | Wikipedia, Google Fact Check, PubMed | Trusted, free, API-accessible knowledge bases |
| **Rate Limiting** | slowapi + Redis | Per-IP abuse prevention + per-user quota enforcement |

---

## 📁 Project Structure

```
Real_Time_Misinformation_Detection_Extension/
│
├── 📂 extension/                       # Chrome Manifest V3 Extension
│   ├── manifest.json                   # Extension config — minimal permissions
│   ├── background.js                   # Service worker: context menu + message relay
│   ├── content.js                      # Content script: captures selected text
│   ├── shared.css                      # Design system: tokens, components, themes
│   ├── 📂 popup/                       # Toolbar popup (quick verdict)
│   │   ├── popup.html                  # Auth form + result card UI
│   │   ├── popup.css                   # Popup-specific sizing (320px)
│   │   └── popup.js                    # Auth flow, verify, token refresh
│   ├── 📂 sidepanel/                   # Side panel (full detail view)
│   │   ├── sidepanel.html              # Sources, accordion, feedback buttons
│   │   ├── sidepanel.css               # Panel-specific styles
│   │   └── sidepanel.js                # Live updates, feedback submission
│   └── 📂 icons/                       # Extension icons (16/32/48/128px)
│
├── 📂 backend/                         # FastAPI Backend Server
│   ├── 📂 app/
│   │   ├── __init__.py
│   │   ├── main.py                     # App entry: CORS, HSTS, rate limiting, error handler
│   │   ├── config.py                   # Settings loaded from environment variables
│   │   ├── database.py                 # Async SQLAlchemy engine + session factory
│   │   ├── models.py                   # ORM models: User, RefreshToken
│   │   ├── auth.py                     # JWT creation/decode, bcrypt, get_current_user
│   │   └── 📂 routes/
│   │       ├── __init__.py
│   │       ├── auth.py                 # POST register/login/refresh/logout
│   │       └── verify.py               # POST verify (two-stage pipeline + cache + quota)
│   ├── 📂 tests/
│   │   ├── __init__.py
│   │   └── test_core.py                # 13 unit tests: auth, sanitization, claim detection
│   ├── requirements.txt                # Pinned dependencies
│   └── .env.example                    # Environment variable template
│
├── .gitignore
└── README.md                           # ← You are here
```

---

## 📡 API Reference

### Authentication

| Method | Endpoint | Auth | Request Body | Response |
|--------|----------|------|-------------|----------|
| `POST` | `/api/v1/auth/register` | — | `{ email, password, name? }` | `{ access_token, refresh_token }` |
| `POST` | `/api/v1/auth/login` | — | `{ email, password }` | `{ access_token, refresh_token }` |
| `POST` | `/api/v1/auth/refresh` | — | `{ refresh_token }` | `{ access_token, refresh_token }` |
| `POST` | `/api/v1/auth/logout` | `Bearer` | `{ refresh_token }` | `204 No Content` |

### Verification

| Method | Endpoint | Auth | Request Body | Response |
|--------|----------|------|-------------|----------|
| `POST` | `/api/v1/verify` | `Bearer` | `{ claim_text }` | `{ verdict, confidence, explanation, sources[], latency_ms }` |
| `POST` | `/api/v1/feedback` | `Bearer` | `{ claim_text, feedback }` | `204 No Content` |
| `GET` | `/api/v1/usage` | `Bearer` | — | `{ checks_today, daily_limit, tier }` |

### System

| Method | Endpoint | Auth | Response |
|--------|----------|------|----------|
| `GET` | `/api/health` | — | `{ status: "ok" }` |

### Example: Verify a Claim

```bash
curl -X POST http://localhost:8000/api/v1/verify \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"claim_text": "The Great Wall of China is visible from space"}'
```

Response:
```json
{
  "verdict": "likely_false",
  "confidence": 91,
  "explanation": "Astronauts have confirmed the Great Wall is not visible from low Earth orbit without aid.",
  "sources": [
    { "title": "Wikipedia: Great Wall of China", "url": "https://en.wikipedia.org/wiki/Great_Wall_of_China" },
    { "title": "NASA: Is the Great Wall visible?", "url": "https://www.nasa.gov/..." }
  ],
  "latency_ms": 1842
}
```

---

## 🔐 Security

This project implements security best practices at every layer:

### Extension Layer
| Measure | Implementation |
|---------|---------------|
| **Content Security Policy** | `script-src 'self'; object-src 'none'` on all HTML pages |
| **Minimal Permissions** | Only `activeTab`, `contextMenus`, `storage`, `sidePanel` — no `<all_urls>` |
| **Token Storage** | Access token in `chrome.storage.session` (cleared on close); refresh token in `chrome.storage.local` |
| **Input Sanitization** | HTML tags stripped, whitespace normalized, 2000 character limit enforced client-side |

### Backend Layer
| Measure | Implementation |
|---------|---------------|
| **HTTPS + HSTS** | TLS enforced, `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| **CORS** | Locked to `chrome-extension://{EXTENSION_ID}` — **no wildcard origins** |
| **JWT Tokens** | 15-minute expiry, HS256 signed with 256-bit secret |
| **Refresh Token Rotation** | Old token revoked on each refresh; tokens SHA-256 hashed in database |
| **Rate Limiting** | 10 requests/minute per IP (slowapi); 50 checks/day per user (Redis) |
| **Security Headers** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` |
| **Error Handling** | Global exception handler — stack traces **never** exposed to client |
| **Zero PII Logging** | User IDs hashed before logging; claim text and IPs never logged |
| **SQL Injection Prevention** | SQLAlchemy ORM with parameterized queries only |
| **Dependency Pinning** | All versions pinned in `requirements.txt` |

---

## 🗺️ Roadmap

| Phase | Status | Goal | Key Deliverables |
|-------|:------:|------|-----------------|
| **Phase 1** | ✅ Complete | Core V1 | Highlight-to-check, 3-state verdict, source links, FastAPI backend, JWT auth, Redis cache |
| **Phase 2** | 🔜 Next | Trust & Polish | Feedback analytics dashboard, privacy policy page, source quality ranking, improved explanations |
| **Phase 3** | 📋 Planned | Coverage | Additional site support, YouTube transcript verification, optional auto-detect suggestions |
| **Phase 4** | 🔮 Future | Multimodal | Image verification, deepfake detection signals — only after quality validation |

---

## 🤝 Contributing

Contributions are welcome and encouraged! This project is open for developers of all skill levels who want to make a real impact on fighting misinformation online.

### How to Contribute

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/<your-username>/Real_Time_Misinformation_Detection_Extension.git
cd Real_Time_Misinformation_Detection_Extension

# 3. Create a feature branch from 'dev' (never from main!)
git checkout dev
git pull origin dev
git checkout -b feature/your-feature-name

# 4. Make your changes and improvements

# 5. Run tests to make sure nothing breaks
cd backend
pip install pytest
pytest tests/ -v
# ✅ All 13 tests must pass before submitting

# 6. Commit with a descriptive message following conventional commits
git add -A
git commit -m "feat: add your feature description"

# 7. Push to your fork
git push origin feature/your-feature-name

# 8. Open a Pull Request against the 'dev' branch (not main!)
```

### Branch Strategy

```
main ◄──────── dev ◄──────── feature/your-feature
 │               │                    │
 │ (stable,      │ (active dev,       │ (your work,
 │  reviewed,    │  all PRs merge     │  branch from
 │  production)  │  here first)       │  dev)
```

| Branch | Purpose | Rules |
|--------|---------|-------|
| `main` | **Production-ready code** | Only updated via reviewed merges from `dev`. Never commit directly. |
| `dev` | **Active development** | All feature branches merge here first. This is the default PR target. |
| `feature/*` | **New features** | Branch from `dev`, PR back to `dev`. Example: `feature/firefox-support` |
| `fix/*` | **Bug fixes** | Branch from `dev`, PR back to `dev`. Example: `fix/token-refresh-race` |
| `docs/*` | **Documentation** | Branch from `dev`, PR back to `dev`. Example: `docs/deployment-guide` |

### Areas Open for Contribution

Whether you're a frontend dev, backend engineer, ML enthusiast, or security researcher — there's something for you:

| Area | Difficulty | Ideas |
|------|:----------:|-------|
| 🧪 **Testing** | 🟢 Easy | Add integration tests, API endpoint tests, edge case coverage |
| 📝 **Documentation** | 🟢 Easy | Deployment guides, video tutorials, FAQ page |
| 🎨 **UI/UX** | 🟡 Medium | Onboarding flow, micro-animations, accessibility (WCAG AA) |
| 🌐 **Browser Support** | 🟡 Medium | Port to Firefox (MV2/V3) or Edge with minimal changes |
| 🌍 **i18n** | 🟡 Medium | Multi-language verdict explanations and UI |
| 📊 **Analytics** | 🟡 Medium | Feedback dashboard, popular claims visualization, accuracy tracking |
| 🔍 **Sources** | 🟠 Advanced | Add more fact-check APIs (Snopes, PolitiFact), improve relevance ranking |
| 🤖 **ML/AI** | 🟠 Advanced | Fine-tune prompts, experiment with different LLM models, add fallback chains |
| 🔒 **Security** | 🟠 Advanced | Penetration testing, CSP hardening, abuse detection improvements |
| 📱 **Mobile** | 🔴 Expert | Mobile browser extension, responsive side panel |

### Code Style

- **Python**: PEP 8 compliant. Use type hints. Keep functions focused.
- **JavaScript**: Vanilla JS only (no frameworks). `const`/`let` over `var`.
- **CSS**: Use custom properties from `shared.css`. No inline styles.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `docs:`, `test:`, `refactor:`

### PR Review Checklist

Before submitting your PR, make sure:

- [ ] All existing tests pass (`pytest tests/ -v`)
- [ ] New features include at least one test
- [ ] PR targets the `dev` branch (not `main`)
- [ ] Commit messages follow conventional commit format
- [ ] No secrets, API keys, or PII in the code
- [ ] Code is formatted and linted

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Google Fact Check Tools API](https://developers.google.com/fact-check/tools/api) — Structured claim review data
- [Wikipedia API](https://www.mediawiki.org/wiki/API:Main_page) — Open knowledge base
- [PubMed E-utilities](https://www.ncbi.nlm.nih.gov/books/NBK25501/) — Biomedical & scientific literature
- [Ollama](https://ollama.com/) — Local LLM inference engine
- [FastAPI](https://fastapi.tiangolo.com/) — High-performance async Python framework

---

<p align="center">
  <strong>Built with ❤️ for a more informed internet.</strong>
</p>

<p align="center">
  <em>If this project helped you or you find it interesting, consider giving it a ⭐</em>
</p>

<p align="center">
  <a href="https://github.com/Kaustubh-Thallam/Real_Time_Misinformation_Detection_Extension/issues">Report Bug</a> •
  <a href="https://github.com/Kaustubh-Thallam/Real_Time_Misinformation_Detection_Extension/issues">Request Feature</a> •
  <a href="https://github.com/Kaustubh-Thallam/Real_Time_Misinformation_Detection_Extension/pulls">Submit PR</a>
</p>
