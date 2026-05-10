# MyChess2nd — AI-Powered Chess Opening Coach

A full-stack chess training platform that analyses your personal game history to build a data-driven opening repertoire, then lets you practise and explore with seven specialised training modes powered by Stockfish 18 and ChessDB.

---

## What it does

Import your Chess.com or Lichess games and get:

- **Welcome dashboard** — Win rate, W/D/L donut, time-control breakdown, first-move bar charts
- **AI Opening Coach** — Recommends opening lines derived from *your* games that lead to position types where you historically win, plus a live Stockfish best-line panel
- **Chess Explorer** — Global opening statistics from ChessDB (quality rating ★●▲, win %, eval bar)
- **Engine Training** — Stockfish 18 multi-PV analysis: 3 engine lines with full move sequence, like chess.com
- **vs Player Database** — Load any opponent's Chess.com/Lichess games; frequency-based arrow overlays show their most common moves (darker = more frequent); engine auto-responds as them
- **Custom Position** — Paste any FEN for instant ChessDB explorer + Stockfish analysis
- **Play vs Stockfish** — 5 difficulty levels with a full game interface

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, react-chessboard v4, chess.js, Axios |
| Engine | Stockfish 18 WASM (single-threaded, runs in browser) |
| Opening data | ChessDB global database (via backend proxy) |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Game import | Chess.com Public API + Lichess API |
| Styling | Pure CSS, custom chess colour palette |

---

## Project structure

```
MyChessSecond/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── game_fetcher.py        # Chess.com & Lichess API integration
│   │   │   ├── pgn_parser.py          # PGN parsing, move extraction
│   │   │   ├── player_profiler.py     # Style analysis, time-control stats
│   │   │   ├── position_classifier.py # Position type classification
│   │   │   └── coach_engine.py        # AI coach line generation
│   │   └── main.py                    # FastAPI routes
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── stockfish-18-lite-single.js  # Stockfish WASM worker
    └── src/
        └── components/
            ├── LandingPage.js/css
            ├── AppLayout.js/css
            ├── WelcomePage.js/css
            ├── GameImporter.js/css
            ├── Questionnaire.js/css
            ├── InteractiveCoach.js/css  # AI coach + engine line panel
            ├── ChessExplorer.js/css     # ChessDB explorer with eval bar
            ├── EngineTraining.js/css    # 3-line Stockfish multi-PV
            ├── TrainVsPlayer.js/css     # vs opponent database
            ├── CustomPosition.js/css    # FEN loader
            └── PlayVsStockfish.js/css   # Play vs engine
```

---

## Setup

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm start
```

App runs at `http://localhost:3000`.

---

## How to use

1. **Import** — Enter your Chess.com or Lichess username on the import screen. The backend fetches and analyses your games.
2. **Welcome** — Your stats dashboard loads immediately. Pick a training mode from the cards or sidebar.
3. **AI Coach** — The first time you click AI Coach, a 5-question position-preference questionnaire runs. Your answers steer the coach engine toward openings that lead to positions you play well.
4. **Other modes** — Chess Explorer, Engine Training, vs Player, Custom Position, and Play vs Stockfish are available instantly with no questionnaire.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/analyze-profile` | Import games and build player profile |
| POST | `/generate-questionnaire` | Build personalised position questions |
| POST | `/submit-preferences` | Save style preferences |
| POST | `/coach/lines` | Get AI coach opening recommendations |
| GET | `/explorer/moves` | My game move frequencies at a FEN |
| GET | `/opening-explorer` | ChessDB global move data at a FEN |
| GET | `/opponent-moves` | Load opponent's move frequencies |

---

## Requirements

- Python 3.9+
- Node.js 18+
- No local Stockfish install needed (runs via WASM in the browser)

---

## License

MIT
