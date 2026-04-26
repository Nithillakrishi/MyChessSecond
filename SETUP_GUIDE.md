# Chess Second - Developer Setup Guide

## What's Included

This complete Chess Second application has been scaffolded with all core components ready to use.

### Backend Components

1. **Game Fetcher** (`app/core/game_fetcher.py`)
   - Chess.com API integration
   - Lichess API integration
   - PGN data fetching

2. **PGN Parser** (`app/core/pgn_parser.py`)
   - Parse PGN games
   - Extract opening lines (configurable depth)
   - Group games by opening
   - Filter by player color

3. **Position Evaluator** (`app/core/evaluator.py`)
   - Stockfish integration
   - Position evaluation
   - Top moves analysis
   - Move sequence evaluation

4. **Opening Analyzer** (`app/core/opening_analyzer.py`)
   - Find matching positions for given moves
   - Generate position pairs for comparison
   - Calculate position statistics

5. **Player Profiler** (`app/core/player_profiler.py`)
   - Analyze player style
   - Extract opening preferences
   - Calculate win rates
   - Find comfortable positions

6. **FastAPI Application** (`app/main.py`)
   - REST API endpoints
   - CORS support
   - Stockfish integration
   - Player profile caching

### Frontend Components

1. **GameImporter** - Import games from Chess.com/Lichess
2. **PlayerProfile** - Display analyzed player statistics
3. **OpeningSelector** - Choose color and opening
4. **PositionComparison** - Compare positions side-by-side

### Styling

- Modern, responsive design
- Dark theme with accent colors
- Mobile-friendly layouts
- Gradient backgrounds

## Key Features Implemented

✅ Game import from Chess.com and Lichess
✅ Player profile analysis
✅ Opening extraction and parsing
✅ Position evaluation with Stockfish
✅ Position comparison UI
✅ Responsive React frontend
✅ FastAPI backend with CORS
✅ Comprehensive documentation

## Dependencies

### Backend (Python)

- FastAPI - Web framework
- Uvicorn - ASGI server
- python-chess - Chess library
- stockfish - Chess engine integration
- requests - HTTP client
- pydantic - Data validation

### Frontend (JavaScript)

- React - UI library
- Axios - HTTP client
- React Scripts - Build tools

## Windows Setup Instructions

### Step 1: Install Prerequisites

- Python 3.8+ from python.org
- Node.js 14+ from nodejs.org
- Stockfish from stockfishchess.org (add to PATH)

### Step 2: Backend Setup

```batch
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Frontend Setup

```batch
cd frontend
npm install
```

### Step 4: Start Services

**Terminal 1 - Backend:**

```batch
cd backend
venv\Scripts\activate
python run.py
```

**Terminal 2 - Frontend:**

```batch
cd frontend
npm start
```

### Step 5: Open in Browser

http://localhost:3000

## macOS/Linux Setup Instructions

### Step 1: Install Prerequisites

```bash
# macOS (using Homebrew)
brew install python3 node stockfish

# Linux (Ubuntu/Debian)
sudo apt-get install python3 python3-venv nodejs stockfish
```

### Step 2: Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Frontend Setup

```bash
cd frontend
npm install
```

### Step 4: Start Services

**Terminal 1:**

```bash
cd backend
source venv/bin/activate
python run.py
```

**Terminal 2:**

```bash
cd frontend
npm start
```

### Step 5: Open in Browser

http://localhost:3000

## API Usage Examples

### 1. Analyze Player Profile

```bash
curl -X POST http://localhost:8000/analyze-profile \
  -H "Content-Type: application/json" \
  -d '{
    "source": "chess.com",
    "username": "your_username"
  }'
```

### 2. Get Opening Positions

```bash
curl -X POST http://localhost:8000/get-opening-positions \
  -H "Content-Type: application/json" \
  -d '{
    "color": "white",
    "first_moves": ["e2e4"]
  }'
```

### 3. Evaluate a Position

```bash
curl -X POST http://localhost:8000/evaluate-position \
  -H "Content-Type: application/json" \
  -d '{
    "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
  }'
```

## Troubleshooting

### Stockfish Not Found

- Windows: Download from stockfishchess.org, add to system PATH
- macOS: `brew install stockfish`
- Linux: `sudo apt-get install stockfish`

### CORS Issues

- Backend already has CORS enabled for all origins
- Check that backend runs on port 8000

### API Connection Failed

- Ensure backend is running: `python run.py`
- Check browser console for errors
- Verify API base URL in frontend

### Node Modules Issues

- Delete `node_modules` folder
- Run `npm install` again
- Clear npm cache: `npm cache clean --force`

## Next Steps

### To Add Features:

1. **Chessboard Visualization**
   - Install `react-chessboard` and `chess.js`
   - Create BoardViewer component

2. **Play Against AI**
   - Integrate chess engine for user moves
   - Create interactive play mode

3. **Save User Preferences**
   - Add database (PostgreSQL/MongoDB)
   - Implement user authentication
   - Save opening repertoires

4. **Opening Tree**
   - Build tree visualization
   - Add move statistics
   - Show variation frequencies

5. **Testing**
   - Add pytest for backend
   - Add Jest for frontend
   - Add integration tests

## Project Structure Summary

```
backend/
├── app/
│   ├── core/         # Core business logic
│   └── main.py       # FastAPI app
├── requirements.txt  # Python dependencies
└── run.py           # Entry point

frontend/
├── public/          # Static files
├── src/
│   ├── components/  # React components
│   ├── App.js       # Main app
│   └── index.js     # Entry point
├── package.json     # Dependencies
└── .gitignore       # Git ignore rules
```

## Performance Notes

- Stockfish search depth set to 20 (can be adjusted)
- Games limited to 100 for Lichess API (prevent timeout)
- Frontend lazy loads components
- Backend caches player profile during session

## Security Considerations

- No authentication required (add for production)
- API open to all origins (restrict in production)
- User data not persisted (add database for production)
- Recommend using HTTPS in production

## Support & Documentation

- See README.md for feature overview
- Check API endpoints in app/main.py
- Review component code for implementation details

---

**Ready to build the future of chess learning!** 🏆
