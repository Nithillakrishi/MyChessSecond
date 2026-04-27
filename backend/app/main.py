"""
Main FastAPI application
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
import os

from app.core.game_fetcher import ChessDotComFetcher, LichessFetcher
from app.core.pgn_parser import PGNParser
# from app.core.evaluator import PositionEvaluator  # Stockfish optional
from app.core.opening_analyzer import OpeningAnalyzer
from app.core.player_profiler import PlayerProfiler

# Initialize FastAPI app
app = FastAPI(title="Chess Second", version="0.1.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
# evaluator = None
player_profile = None
games_data = None

# Pydantic models
class FetchGamesRequest(BaseModel):
    source: str  # "chess.com" or "lichess"
    username: str

class OpeningRequest(BaseModel):
    color: str  # "white" or "black"
    first_moves: List[str]  # e.g., ["e2e4"]

class EvaluatePositionRequest(BaseModel):
    fen: str

@app.on_event("startup")
async def startup():
    """Startup event - Stockfish is optional"""
    pass


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

@app.post("/fetch-games")
async def fetch_games(request: FetchGamesRequest):
    """
    Fetch games from Chess.com or Lichess
    """
    global games_data
    
    try:
        if request.source.lower() == "chess.com":
            fetcher = ChessDotComFetcher()
            pgn_data = fetcher.get_games(request.username, max_archives=6)  # Fetch 6 months
        elif request.source.lower() == "lichess":
            fetcher = LichessFetcher()
            pgn_data = fetcher.get_games(request.username, max_games=50)
        else:
            raise HTTPException(status_code=400, detail="Invalid source. Use 'chess.com' or 'lichess'")
        
        if not pgn_data:
            raise HTTPException(status_code=404, detail="No games found for this user")
        
        # Parse games
        games = PGNParser.parse_pgn(pgn_data)
        
        # Extract opening data
        games_data = []
        for game in games:
            opening_info = PGNParser.extract_opening_moves(game, depth=12)
            games_data.append(opening_info)
        
        return {
            "message": f"Fetched {len(games)} games",
            "count": len(games),
            "source": request.source
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching games: {str(e)}")

@app.post("/analyze-profile")
async def analyze_profile(request: FetchGamesRequest):
    """
    Analyze player profile and preferences
    """
    global player_profile, games_data
    
    print(f"Fetching games for {request.username} from {request.source}...")
    
    if request.source.lower() == "chess.com":
        fetcher = ChessDotComFetcher()
        pgn_data = fetcher.get_games(request.username, max_archives=12)  # Fetch 12 months for better profile
    elif request.source.lower() == "lichess":
        fetcher = LichessFetcher()
        pgn_data = fetcher.get_games(request.username, max_games=100)
    else:
        raise HTTPException(status_code=400, detail="Invalid source")
    
    if not pgn_data:
        print(f"No games found for {request.username}")
        if request.source.lower() == "chess.com":
            detail = f"No public games found for Chess.com user '{request.username}'. Their games may be private. Try using Lichess instead, which has more public game data."
        else:
            detail = f"No games found for Lichess user '{request.username}'. This user may not exist or has no public games."
        raise HTTPException(status_code=404, detail=detail)
    
    try:
        print(f"Got {len(pgn_data)} chars of PGN data, parsing...")
        # Parse and analyze
        games = PGNParser.parse_pgn(pgn_data)
        print(f"Parsed {len(games)} games")
        
        player_profile = PlayerProfiler.analyze_player_style(games)
        print(f"Analyzed player style: {player_profile}")
        
        # Store games data
        games_data = []
        for game in games:
            opening_info = PGNParser.extract_opening_moves(game, depth=12)
            games_data.append(opening_info)
        
        print(f"Extracted opening info from {len(games_data)} games")
        return player_profile
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error parsing/analyzing: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error analyzing profile: {str(e)}")

@app.post("/test-sample")
async def test_sample():
    """
    Test endpoint with sample PGN data for demo purposes
    """
    global player_profile, games_data
    
    # Sample PGN games for testing
    sample_pgn = """[Event "Rated Blitz"]
[Site "https://lichess.org"]
[White "TestPlayer1"]
[Black "TestPlayer2"]
[Result "1-0"]
[WhiteElo "1800"]
[BlackElo "1750"]
[Opening "Ruy Lopez"]
[ECO "C62"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 d6 4. O-O Nge7 5. d4 a6 6. Ba4 b5 7. Bb3 exd4 8. Nxd4 Nxd4 9. Qxd4 c5 10. Qd1 Bg7 11. Nc3 O-O 12. Re1 Re8 13. Bf4 Bf6 14. Qf3 Bxb2 15. Rab1 Bf6 16. Qg3 Nf6 17. e5 dxe5 18. Rxe5 h6 19. Bh4 g6 20. Qf3 1-0

[Event "Rated Rapid"]
[Site "https://lichess.org"]
[White "TestPlayer2"]
[Black "TestPlayer1"]
[Result "0-1"]
[WhiteElo "1750"]
[BlackElo "1800"]
[Opening "Italian Game"]
[ECO "C50"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. bxc3 d5 10. cxb4 dxc4 11. Re1 O-O 12. Rxe4 Bf5 13. Re2 c6 14. d5 c5 15. bxc5 0-1

[Event "Casual Blitz"]
[Site "https://lichess.org"]
[White "TestPlayer1"]
[Black "TestPlayer3"]
[Result "1-0"]
[WhiteElo "1800"]
[BlackElo "1600"]
[Opening "Sicilian Defense"]
[ECO "B20"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 11. g4 b5 12. g5 b4 13. Ne2 Ne8 14. f4 a5 15. fxe5 1-0

[Event "Rapid Tournament"]
[Site "https://lichess.org"]
[White "TestPlayer3"]
[Black "TestPlayer1"]
[Result "0-1"]
[WhiteElo "1600"]
[BlackElo "1800"]
[Opening "French Defense"]
[ECO "C00"]

1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be2 cxd4 8. Nxd4 Nxd4 9. Qxd4 Nxe5 10. fxe5 Qb6+ 11. Kh1 Qxd4 12. Nxd4 0-1"""
    
    try:
        games = PGNParser.parse_pgn(sample_pgn)
        print(f"Parsed {len(games)} sample games")
        
        player_profile = PlayerProfiler.analyze_player_style(games)
        print(f"Sample profile: {player_profile}")
        
        games_data = []
        for game in games:
            opening_info = PGNParser.extract_opening_moves(game, depth=12)
            games_data.append(opening_info)
        
        return {
            "message": "Sample data loaded successfully",
            "player_profile": player_profile,
            "games_count": len(games)
        }
    except Exception as e:
        import traceback
        print(f"Error loading sample: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/get-opening-positions")
async def get_opening_positions(request: OpeningRequest):
    """
    Get candidate positions for a given opening line
    """
    global games_data
    
    if not games_data:
        raise HTTPException(status_code=400, detail="No games loaded. Fetch games first.")
    
    try:
        # Find matching positions
        positions = OpeningAnalyzer.find_matching_positions(
            games_data,
            request.first_moves,
            count=10
        )
        
        if not positions:
            raise HTTPException(status_code=404, detail="No positions found for this opening")
        
        # Positions without evaluations (Stockfish not available)
        result_pairs = positions
        
        return {
            "color": request.color,
            "first_moves": request.first_moves,
            "pairs": result_pairs,
            "total_pairs": len(result_pairs)
        }
    except Exception as e:
        import traceback
        print(f"Error getting positions: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/evaluate-position")
async def evaluate_position(request: EvaluatePositionRequest):
    """
    Evaluate a single position (Stockfish not installed)
    """
    raise HTTPException(status_code=503, detail="Stockfish not installed. Install stockfish library to enable position evaluation: pip install stockfish")

@app.get("/player-stats")
async def get_player_stats():
    """
    Get stored player profile statistics
    """
    global player_profile
    
    if not player_profile:
        raise HTTPException(status_code=400, detail="No player profile loaded")
    
    return player_profile

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
