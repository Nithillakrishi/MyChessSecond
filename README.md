# Chess Second - Your Opening Coach 🏃♟️

A smart chess opening analysis tool that uses your Chess.com or Lichess game data to help you find and master positions that suit your playing style.

## Features

- **Game Import**: Connect your Chess.com or Lichess account and import your games
- **Player Profile Analysis**: Automatically analyze your playing style, favorite openings, and win rates
- **Opening Selection**: Choose openings by color and see positions from your own games
- **Position Comparison**: Compare candidate positions side-by-side with Stockfish evaluations
- **Smart Recommendations**: Get personalized suggestions based on your playing history

## Technology Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + Axios
- **Analysis**: Stockfish engine (for position evaluation)
- **Data Sources**: Chess.com API + Lichess API

## Project Structure

```
MyChessSecond/
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   ├── game_fetcher.py      # Chess.com & Lichess API integration
│   │   │   ├── pgn_parser.py        # Parse PGN games and extract openings
│   │   │   ├── evaluator.py         # Stockfish integration
│   │   │   ├── opening_analyzer.py  # Find and compare opening positions
│   │   │   └── player_profiler.py   # Analyze player style
│   │   └── main.py                  # FastAPI application
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── GameImporter.js
│   │   │   ├── GameImporter.css
│   │   │   ├── PlayerProfile.js
│   │   │   ├── PlayerProfile.css
│   │   │   ├── OpeningSelector.js
│   │   │   ├── OpeningSelector.css
│   │   │   ├── PositionComparison.js
│   │   │   └── PositionComparison.css
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
└── README.md
```

## Installation

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create a Python virtual environment:

```bash
python -m venv venv
```

3. Activate the virtual environment:
   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. Install Python dependencies:

```bash
pip install -r requirements.txt
```

5. Install Stockfish engine:
   - **Windows**: Download from [stockfishchess.org](https://stockfishchess.org) and add to PATH
   - **macOS**: `brew install stockfish`
   - **Linux**: `sudo apt-get install stockfish`

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install Node dependencies:

```bash
npm install
```

## Running the Application

### Start the Backend Server

From the `backend` directory (with virtual environment activated):

```bash
python run.py
```

The API server will be available at `http://localhost:8000`

### Start the Frontend Development Server

From the `frontend` directory:

```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### POST `/fetch-games`

Fetch games from a user account.

```json
{
  "source": "chess.com" | "lichess",
  "username": "username"
}
```

### POST `/analyze-profile`

Analyze player's style and preferences.

```json
{
  "source": "chess.com" | "lichess",
  "username": "username"
}
```

### POST `/get-opening-positions`

Get candidate positions for a specific opening.

```json
{
  "color": "white" | "black",
  "first_moves": ["e2e4", "c7c5"]
}
```

### POST `/evaluate-position`

Evaluate a chess position using Stockfish.

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
}
```

### GET `/player-stats`

Get the stored player profile statistics.

## How It Works

1. **Import Games**: Connect to Chess.com or Lichess and fetch your recent games
2. **Analyze Style**: The system analyzes your games to determine:
   - Your favorite openings
   - Preferred first moves
   - Win rates by position
   - Average rating levels
3. **Select Opening**: Choose which color to play and which opening to study
4. **Compare Positions**: See 10 positions (in 5 pairs) from your own games that follow the opening
5. **Evaluate**: Stockfish evaluates each position so you can see which ones are stronger
6. **Choose Position**: Select a position that you feel comfortable with to continue studying

## Usage Example

1. Open http://localhost:3000 in your browser
2. Enter your Chess.com username (or Lichess username)
3. View your player profile
4. Choose to play as White or Black
5. Select an opening (e.g., Sicilian Defense with ...c5)
6. Compare candidate positions
7. Select a position to continue

## Future Enhancements

- Interactive chessboard visualization
- Play against the AI from selected positions
- Create personalized opening trees
- Track learning progress
- Export opening repertoire as PGN

## Requirements

- Python 3.8+
- Node.js 14+
- Stockfish 14+

## License

MIT

## Contributing

Contributions are welcome! Please submit pull requests or open issues for bugs and feature requests.

## Support

For issues, questions, or suggestions, please open an issue on the repository.

---

**Chess Second** - Master your openings with data from your games.
