# MyChess2nd — AI-Powered Chess Opening Coach

> A full-stack chess training platform that analyses your personal game history to build a data-driven opening repertoire, then lets you practise across seven specialised training modes powered by Stockfish 18 and ChessDB.

**Live:** [my-chess-2nd.vercel.app](https://my-chess-2nd.vercel.app)

---

## Features

| Mode | Description |
|---|---|
| **Welcome Dashboard** | Win rate, W/D/L donut, time-control breakdown, first-move bar charts |
| **AI Opening Coach** | Recommends lines from *your* games toward positions where you historically win — with a live Stockfish best-line panel and AI chatbot |
| **Chess Explorer** | Global opening statistics from ChessDB — quality rating ★●▲, win %, eval bar |
| **Engine Training** | Stockfish 18 multi-PV: 3 engine lines with full move sequence |
| **vs Player Database** | Load any opponent's games; frequency-based arrow overlays show their most common moves; engine auto-responds as them |
| **Game Analysis** | Paste any PGN or FEN; navigate every move with ChessDB explorer + Stockfish analysis |
| **Play vs Stockfish** | Full game against the engine across five difficulty levels |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, react-chessboard v4, chess.js, Axios |
| Engine | Stockfish 18 WASM (single-threaded, runs in browser) |
| Opening data | ChessDB global database (via backend proxy) |
| Backend | Python 3.12, FastAPI, Uvicorn |
| AI Coach | Groq API · LLaMA 3.3 70B |
| Auth | Supabase (Google OAuth) |
| Game import | Chess.com Public API + Lichess API |
| Styling | Pure CSS with custom chess colour palette + Syne/JetBrains Mono fonts |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## Project Structure

```
MyChessSecond/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── game_fetcher.py        # Chess.com & Lichess API integration
│   │   │   ├── pgn_parser.py          # PGN parsing, move extraction
│   │   │   ├── player_profiler.py     # Style analysis, time-control stats
│   │   │   ├── position_classifier.py # Position type classification
│   │   │   └── opening_analyzer.py    # Opening line matching
│   │   ├── database.py                # SQLite session cache
│   │   └── main.py                    # FastAPI routes
│   ├── requirements.txt
│   └── .env                           # GROQ_API_KEY
└── frontend/
    ├── public/
    │   └── stockfish-18-lite-single.js  # Stockfish WASM worker
    ├── src/
    │   ├── components/
    │   │   ├── LandingPage.js/css      # Marketing landing page
    │   │   ├── AppLayout.js/css        # Sidebar + bottom mobile nav
    │   │   ├── WelcomePage.js/css      # Stats dashboard
    │   │   ├── InteractiveCoach.js/css # AI coach + chatbot
    │   │   ├── ChessExplorer.js/css    # ChessDB explorer with eval bar
    │   │   ├── EngineTraining.js/css   # 3-line Stockfish multi-PV
    │   │   ├── TrainVsPlayer.js/css    # vs opponent database
    │   │   ├── CustomPosition.js/css   # FEN loader + analysis
    │   │   ├── PlayVsStockfish.js/css  # Play vs engine
    │   │   ├── LoginPage.js/css        # Google OAuth login
    │   │   └── AccountSettings.js/css  # Change username / sign out
    │   ├── contexts/
    │   │   ├── AuthContext.js          # Supabase auth state
    │   │   └── ThemeContext.js         # Board colour themes
    │   └── supabase.js                # Supabase client
    └── .env                           # REACT_APP_SUPABASE_* + REACT_APP_API_BASE
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.9+
- A [Supabase](https://supabase.com) project with Google OAuth configured
- A [Groq](https://console.groq.com) API key

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:
```
GROQ_API_KEY=your_groq_api_key_here
```

```bash
uvicorn app.main:app --reload
# API at http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
REACT_APP_API_BASE=http://localhost:8000
FAST_REFRESH=false
```

```bash
npm start
# App at http://localhost:3000
```

---

## Authentication Setup (Supabase)

1. Create a Supabase project
2. Enable Google provider under **Authentication → Providers → Google**
3. Add your Google OAuth client ID and secret
4. Run this SQL to create the user profiles table:

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chess_username TEXT,
  chess_source TEXT DEFAULT 'chess.com',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile"
  ON user_profiles FOR ALL USING (auth.uid() = id);
```

5. Add `http://localhost:3000` and your Vercel URL to **Authentication → URL Configuration → Redirect URLs**

---

## Deployment

### Frontend → Vercel

1. Import the GitHub repo at vercel.com
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_API_BASE` → your Render backend URL
   - `CI=false`
   - `FAST_REFRESH=false`

### Backend → Render

1. New Web Service → connect GitHub repo
2. **Root Directory**: `backend`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `GROQ_API_KEY`

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/analyze-profile` | Import games and build player profile |
| POST | `/generate-questionnaire` | Build personalised position questions |
| POST | `/submit-preferences` | Save style preferences |
| POST | `/coach/lines` | Get AI coach opening recommendations |
| POST | `/coach/chat` | AI chatbot response (Groq / LLaMA 3.3) |
| POST | `/coach/preload` | Pre-generate opening theory for a line |
| GET | `/coach/sessions` | List saved coaching sessions |
| GET | `/explorer/moves` | Game move frequencies at a FEN |
| GET | `/opening-explorer` | ChessDB global move data at a FEN |
| GET | `/opponent-moves` | Load opponent's move frequencies |
| GET | `/health` | Health check |

---

## How to Use

1. **Sign in** with Google on the login screen
2. **Enter your Chess.com or Lichess username** — the app remembers it across devices via Supabase
3. **Import** — the backend fetches and analyses your games (takes ~10-60 seconds)
4. **Welcome dashboard** loads with your stats. Pick a training mode from the sidebar
5. **AI Coach** — first run triggers a 5-question questionnaire to calibrate the engine toward positions you win in
6. All other modes are available immediately with no extra setup

---

## Requirements

- No local Stockfish install needed — runs via WASM in the browser
- Free Groq API key for the AI coach (llama-3.3-70b-versatile)
- Free Supabase project for authentication

---

## License

MIT
