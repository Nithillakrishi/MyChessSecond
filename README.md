# Chess Second - Your Opening Coach 🏃♟️

A smart chess opening analysis tool that creates **personalized opening repertoires** by matching your natural playing style with new openings to surprise opponents.

## The Problem

Chess players face a dilemma:

- 🎯 You want to **try new openings** to surprise opponents
- 😟 But you're afraid of leaving your **comfort zone** - positions you play well

**Chess Second solves this:** Find positions where you naturally excel, then learn how to reach them through different openings.

## The Solution

Instead of memorizing generic opening theory, Chess Second:

1. **Analyzes your games** to find positions you play exceptionally well
2. **Asks your preferences** via an interactive questionnaire (5 questions with 2 positions each)
3. **Gets your desired opening moves** (what you want to play first)
4. **Creates a personalized repertoire** combining:
   - Your chosen opening moves (to surprise opponents)
   - Your comfortable positions (where you play best)
   - Games from your history showing successful play in these positions

### Example

> You play amazing in **Kingside Fianchetto positions** (which you normally reach via `1.d4 Nf6 2.c4 g6 3.g3`), but today you want to surprise with `1.c4`.
>
> Chess Second navigates you through a **Reti Opening** or **English Opening** that also leads to similar Kingside Fianchetto structures - achieving both goals: surprising your opponent AND playing positions where you excel.

## Current Status

⚡ **Currently analyzing personal account: `NithilPY` (Chess.com)**

This application is currently optimized for analyzing a single user's account and will be expanded to support multi-user comparison in future versions.

**To analyze your own account**, visit: `http://localhost:3000` and enter your Chess.com or Lichess username.

## Features

- **Game Import**: Connect your Chess.com or Lichess account and import your games
- **Comfort Zone Analysis**: Automatically identify positions where you play exceptionally well
- **Interactive Questionnaire**: Answer 5 position preference questions to rank your favorite position types
- **Opening Preference Input**: Choose your desired opening moves (1-3 moves) to surprise opponents
- **Personalized Repertoire**: Get opening recommendations that combine:
  - Your preferred opening moves
  - Your comfortable position types
  - Winning game examples from your history
- **Smart Navigation**: See candidate lines and positions from your actual games showing successful play

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

### Profile Analysis

#### POST `/analyze-profile`

Analyze player's games and create player profile.

**Request**:

```json
{
  "source": "chess.com" | "lichess",
  "username": "NithilPY"
}
```

**Response**:

```json
{
  "total_games": 740,
  "win_rate": 0.509,
  "total_games_as_white": 363,
  "total_games_as_black": 377,
  "first_moves": {"d2d4": 447, "e2e4": 228, ...},
  "preferred_openings": {...},
  "eco_codes": {...}
}
```

#### GET `/player-stats`

Get the stored player profile statistics.

---

### Personalized Repertoire

#### POST `/generate-questionnaire`

Generate 5 position preference questions based on your games.

**Request**:

```json
{
  "source": "chess.com",
  "username": "NithilPY"
}
```

**Response**: 5 questions showing different position types and YOUR win rates:

```json
{
  "questions": [
    {
      "question_id": 1,
      "position_type_1": "Fianchetto",
      "position_type_2": "CentralControl",
      "description_1": "Fianchettoed bishop on long diagonal...",
      "your_win_rate_1": "52.3%",
      "your_win_rate_2": "48.1%"
    }
  ],
  "position_types_found": 9
}
```

#### POST `/submit-preferences`

Save your position preferences and desired opening moves.

**Request**:

```json
{
  "username": "NithilPY",
  "preferences": {
    "Fianchetto": 5,
    "CentralControl": 4,
    "KingsideAttack": 4,
    "SharpTactical": 2,
    "ClosedPositional": 3
  },
  "desired_first_moves": ["c2c4", "d2d4"],
  "color": "white"
}
```

#### GET `/get-personalized-repertoire`

Generate personalized opening lines combining your preferences and desired first moves.

**Response**:

```json
{
  "username": "NithilPY",
  "desired_first_moves": ["c2c4", "d2d4"],
  "preferred_position_types": [
    "Fianchetto",
    "CentralControl",
    "KingsideAttack"
  ],
  "recommended_lines": [
    {
      "moves": ["c2c4", "g7g6", "g2g3", "f8g7"],
      "opening": "English Opening / Fianchetto",
      "position_types_reached": ["Fianchetto", "CentralControl"],
      "outcome": "win"
    }
  ]
}
```

---

### Legacy Endpoints

#### POST `/get-opening-positions`

Get candidate positions for a specific opening.

```json
{
  "color": "white" | "black",
  "first_moves": ["e2e4", "c7c5"]
}
```

#### POST `/evaluate-position`

Evaluate a chess position using Stockfish (not installed by default).

```json
{
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
}
```

## How It Works

### 1. Game Analysis Phase

- Import all your Chess.com/Lichess games
- Analyze positions and calculate win rates
- Identify "comfort zones" - positions where you consistently play well

### 2. Preference Questionnaire

- Answer 5 position comparison questions
- Each question presents 2 different position types from your games
- Rank which position structures you prefer (e.g., "Kingside Fianchetto vs Centralized Knights")

### 3. Opening Move Selection

- Choose which **first 1-3 moves** you want to play (to surprise opponents)
- Specify your color preference (White or Black)

### 4. Personalized Repertoire Generation

The system creates a custom opening repertoire that:

- **Starts with your chosen opening moves** (e.g., 1.c4 instead of 1.d4)
- **Leads to your comfortable positions** (same position types you ranked highly)
- **Shows your best games** as examples in these structures

### 5. Study & Play

- Review the recommended lines with real games from your history
- Study successful positions from your past wins
- Play with confidence in positions you've mastered

## Usage Example

### For NithilPY:

1. **System analyzes NithilPY's 740 games** and finds:
   - Comfortable positions: Kingside Fianchetto structures
   - Strong position types: Centralized knights with space advantage
   - Win rate: 50.95% overall

2. **Questionnaire (5 questions)**:
   - Position pair 1: "Kingside Fianchetto vs Central Control" → You prefer Fianchetto
   - Position pair 2: "Closed Positional vs Sharp Tactical" → You prefer Closed
   - Position pair 3: "Queenside Attack vs Kingside Attack" → You prefer Kingside
   - Position pair 4: "Early Rooks Exchange vs Long Middlegame" → You prefer Long Middlegame
   - Position pair 5: "Symmetrical Pawn Structure vs Asymmetrical" → You prefer Asymmetrical

3. **Choose opening moves**: "I want to play `1.c4` to surprise, but reach my comfortable Fianchetto positions"

4. **Personalized repertoire generated**:
   - English Opening: 1.c4 (your surprise move)
   - Leads to: 1.c4 g6 2.g3 (transposing to Fianchetto structures)
   - Shows 5 of your best games reaching similar positions
   - Evaluates recommended continuation squares

5. **Study and implement**!

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

#niggil
