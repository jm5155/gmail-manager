# 📧 Gmail Manager — AI-Powered Email Intelligence

> Smart labeling, scam detection, security scanning, and email rewriting — all powered by a multi-AI cascade system.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)
![Stack](https://img.shields.io/badge/stack-Electron%20%2B%20React%20%2B%20FastAPI-purple)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **🏷️ Auto Labels** | AI analyzes every email and applies colored Gmail labels (Work, Finance, Newsletter, etc.) |
| **🛡️ Scam Shield** | Detects phishing, scam indicators, and assigns 0-100 risk scores |
| **🔗 URL Scanner** | Checks every link against Google Safe Browsing API for malware/phishing |
| **🔒 Quarantine** | Automatically isolates suspicious emails with one-click safe/delete actions |
| **✏️ AI Rewriter** | Transform any email with presets (Professional, Shorten, Friendly) or custom instructions |
| **📊 Smart Filters** | Filter by sender, label, scam score — all server-side with debounced search |
| **🔄 AI Failover** | Cascade: NVIDIA → Gemini → Cohere — automatic fallback on rate limits |

---

## 🏗️ Architecture

```
gmail-manager/
├── backend/                    # Python FastAPI (port 8000)
│   ├── main.py                 # API entry point — 18 endpoints
│   ├── auth.py                 # Google OAuth 2.0 flow + token persistence
│   ├── gmail.py                # Gmail API + bulk analysis pipeline
│   ├── ai_router.py            # AI cascade: NVIDIA → Gemini → Cohere
│   ├── security.py             # URL scanner + Safe Browsing API
│   ├── database.py             # SQLite3 — analyzed emails + URL cache
│   ├── requirements.txt        # Python dependencies
│   └── .env                    # API keys (never committed)
├── frontend/                   # React + Vite (port 5173)
│   ├── src/
│   │   ├── App.jsx             # Root routing + sidebar layout
│   │   ├── main.jsx            # React entry point
│   │   ├── index.css           # Design system tokens
│   │   ├── pages/
│   │   │   ├── Login.jsx       # Google OAuth login
│   │   │   ├── Inbox.jsx       # Email list + bulk analysis
│   │   │   ├── ScamAlerts.jsx  # Risk-filtered scam alerts
│   │   │   ├── Quarantine.jsx  # Quarantined email management
│   │   │   ├── Rewriter.jsx    # AI email rewriter
│   │   │   └── Settings.jsx    # Provider status + account
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       ├── EmailCard.jsx
│   │       ├── ScamBadge.jsx
│   │       ├── ProgressBar.jsx
│   │       ├── ToastNotification.jsx
│   │       └── ConfirmModal.jsx
│   └── index.html
├── electron/                   # Desktop wrapper
│   ├── main.js                 # Dev/prod detection + backend lifecycle
│   ├── preload.js              # Context bridge
│   └── resources/              # PyInstaller output (production)
└── package.json                # Electron + build config
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Google Cloud Console** project with Gmail API enabled

---

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Enabled APIs** → Enable **Gmail API**
4. Navigate to **APIs & Services** → **Credentials**
5. Click **Create Credentials** → **OAuth client ID**
6. Application type: **Web application**
7. Add authorized redirect URI: `http://localhost:8000/auth/callback`
8. Copy the **Client ID** and **Client Secret**

### Step 2: Get AI Provider API Keys

| Provider | Where to get it | Model used |
|----------|----------------|------------|
| **NVIDIA NIM** (Primary) | [build.nvidia.com](https://build.nvidia.com/) → Get API Key | minimaxai/minimax-m2.7 |
| **Google Gemini** (Secondary) | [aistudio.google.com](https://aistudio.google.com/) → Get API Key | gemini-2.0-flash |
| **Cohere** (Tertiary) | [cohere.com](https://dashboard.cohere.com/api-keys) → Sign up → API Keys | command-r |
| **Groq** (Future) | [groq.com](https://console.groq.com/keys) → Sign up → API Keys | llama3-8b-8192 |

### Step 3: Get Google Safe Browsing Key (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Safe Browsing API**
3. Create an API key under **Credentials**
4. Free tier: 10,000 lookups/day

### Step 4: Configure Environment

Create/edit `backend/.env`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/callback

# AI Providers (at least one required)
NVIDIA_API_KEY=nvapi-...
GEMINI_API_KEY=AIzaSy...
COHERE_API_KEY=...
GROQ_API_KEY=gsk_...

# Security (optional)
GOOGLE_SAFE_BROWSING_KEY=AIzaSy...
```

### Step 5: Install Dependencies

```bash
# Backend (Python)
cd backend
pip install -r requirements.txt

# Frontend (Node.js)
cd ../frontend
npm install

# Electron (root)
cd ..
npm install
```

### Step 6: Run in Development

Open **3 terminals**:

```bash
# Terminal 1 — Backend
cd backend
python main.py
# → Runs on http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm run dev
# → Runs on http://localhost:5173

# Terminal 3 — Electron (optional)
cd gmail-manager
npm start
# → Opens desktop window
```

Or use the combined command from the root:
```bash
npm run dev
```

Then open **http://localhost:5173** in your browser.

---

## 📦 Building for Production

### Full Build Pipeline

```bash
# Step 1: Build the frontend (Vite → frontend/dist/)
cd frontend
npm run build

# Step 2: Bundle the backend (PyInstaller → electron/resources/)
cd ../backend
pip install pyinstaller
pyinstaller --onefile --name gmail-manager-backend --distpath ../electron/resources main.py

# Step 3: Build the Electron installer
cd ..
npm run build:electron

# → Installer is in dist/ folder
```

Or run the full pipeline:
```bash
npm run build
```

### Output

| File | Location |
|------|----------|
| Frontend build | `frontend/dist/` |
| Backend executable | `electron/resources/gmail-manager-backend.exe` |
| Windows installer | `dist/Gmail Manager Setup 1.0.0.exe` |

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/auth/login` | Trigger Google OAuth |
| GET | `/auth/callback` | OAuth callback |
| GET | `/auth/status` | Login status + user email |
| POST | `/auth/logout` | Logout |
| GET | `/emails/fetch` | Fetch emails from Gmail |
| GET | `/emails/analyzed` | Get cached analyzed emails |
| GET | `/emails/stats` | Analysis statistics |
| GET | `/emails/filter` | Filter/sort emails |
| POST | `/ai/analyze-email` | Single email AI analysis |
| POST | `/ai/rewrite` | AI email rewrite |
| GET | `/ai/status` | AI provider status |
| POST | `/emails/analyze-bulk` | Bulk analysis (SSE) |
| POST | `/security/scan-email` | Security URL scan |
| GET | `/quarantine` | List quarantined |
| POST | `/quarantine/{id}/safe` | Mark as safe |
| DELETE | `/quarantine/{id}` | Move to trash |
| GET | `/scam/alerts` | Get scam alerts |
| POST | `/scam/reanalyze/{id}` | Re-analyze scam score |

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary | `#2563EB` |
| Background | `#0F172A` |
| Surface | `#1E293B` |
| Border | `#334155` |
| Text Primary | `#F1F5F9` |
| Text Secondary | `#94A3B8` |
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |
| Font | Inter (Google Fonts) |
| Card Radius | 12px |
| Button Radius | 8px |
| Badge Radius | 999px (pill) |

---

## 🔐 Security

- All credentials stored locally in `backend/.env` — never transmitted
- OAuth tokens saved to `backend/token.json` — auto-refreshed
- URL safety results cached in SQLite (24-hour expiry)
- Emails never leave your machine — all AI analysis uses your own API keys
- Electron runs with `contextIsolation: true` and `nodeIntegration: false`

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.
