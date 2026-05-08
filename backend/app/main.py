"""
Main FastAPI application
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Tuple
import json
import os

from app.core.game_fetcher import ChessDotComFetcher, LichessFetcher
from app.core.pgn_parser import PGNParser
# from app.core.evaluator import PositionEvaluator  # Stockfish optional
from app.core.opening_analyzer import OpeningAnalyzer
from app.core.player_profiler import PlayerProfiler
from app.core.position_classifier import PositionClassifier

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
position_types_map = None
user_preferences = None

# Pydantic models
class FetchGamesRequest(BaseModel):
    source: str  # "chess.com" or "lichess"
    username: str

class OpeningRequest(BaseModel):
    color: str  # "white" or "black"
    first_moves: List[str]  # e.g., ["e2e4"]

class EvaluatePositionRequest(BaseModel):
    fen: str

class PositionPairQuestion(BaseModel):
    question_id: int
    position_type_1: str
    position_type_2: str
    description_1: str
    description_2: str

class QuestionnaireResponse(BaseModel):
    username: str
    preferences: Dict[str, int]  # position_type -> preference_score (1-5)
    desired_first_moves: Optional[List[str]] = None  # Make backwards compatible/optional
    color: str  # "white" or "black"
async def coach_position(request: CoachPositionRequest):
    global user_preferences, games_data
    if not games_data or not user_preferences:
         return {"total_games": 0, "wins": 0, "losses": 0, "draws": 0, "recommended_moves": []}
         
    # Track stats
    wins = 0
    losses = 0
    draws = 0
    total = 0
    
    # Recommendations map: Move -> style type
    recommendations_map = {}
    
    username = user_preferences["username"].lower()
    
    seq_len = len(request.moves)
    for game in games_data:
        g_moves = game.get("moves", [])
        # Check if game matches sequence
        if len(g_moves) > seq_len and g_moves[:seq_len] == request.moves:
            total += 1
            is_white = game.get("white", "").lower() == username
            result = game.get("result", "*")
            
            if result == "1-0":
                 if is_white: wins += 1 
                 else: losses += 1
            elif result == "0-1":
                 if is_white: losses += 1 
                 else: wins += 1
            else:
                 draws += 1
                 
            # Find next move the player made and if it leads to favorable position
            next_move = g_moves[seq_len]
            positions = game.get("positions", [])
            if len(positions) > seq_len + 3:
                # Classify future position
                future_pos = PositionClassifier.classify_position(positions[seq_len + 3])
                p_type = future_pos.get("position_type")
                if p_type in user_preferences.get("position_preferences", {}):
                    # Higher preference weight means it's a stronger recommendation
                    if user_preferences["position_preferences"].get(p_type, 0) > 3:
                        if next_move not in recommendations_map:
                             recommendations_map[next_move] = p_type

    rec_list = [{"move": m, "style": s} for m, s in recommendations_map.items()]
    
    return {
        "total_games": total,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "recommended_moves": rec_list[:3] # top 3
    }


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
    Currently supports analyzing single user accounts.
    Future versions will support comparing multiple players.
    """
    global player_profile, games_data
    
    print(f"Fetching games for {request.username} from {request.source}...")
    
    if request.source.lower() == "chess.com":
        fetcher = ChessDotComFetcher()
        pgn_data = fetcher.get_games(request.username, max_archives=0)  # Fetch ALL months for full profile
    elif request.source.lower() == "lichess":
        fetcher = LichessFetcher()
        pgn_data = fetcher.get_games(request.username, max_games=5000)
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
        
        # Pass username to profiler to properly identify player perspective
        player_profile = PlayerProfiler.analyze_player_style(games, username=request.username)
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

@app.post("/generate-questionnaire")
async def generate_questionnaire(request: FetchGamesRequest):
    """
    Generate a position preference questionnaire based on player's games
    Returns 5 questions with contrasting position types
    """
    global position_types_map, games_data, player_profile
    
    if not games_data or not player_profile:
        raise HTTPException(status_code=400, detail="Must analyze profile first")
    
    try:
        print(f"Generating questionnaire for {request.username}...")
        
        # Classify all positions by type
        position_types_map = PositionClassifier.classify_games_by_position_type(
            games_data, 
            request.username
        )
        print(f"Classified {sum(len(p) for p in position_types_map.values())} positions into {len(position_types_map)} types")
        
        # Find contrasting position pairs for questionnaire
        position_pairs = PositionClassifier.find_best_position_pairs(
            position_types_map,
            num_pairs=5
        )
        
        if not position_pairs:
            raise HTTPException(status_code=400, detail="Not enough position types to generate questionnaire")
        
        # Create questions
        position_descriptions = {
            "Fianchetto": "Fianchettoed bishop on long diagonal, flexible pawn structure",
            "CentralControl": "Centralized pieces with strong control of center",
            "KingsideAttack": "Kingside attacking chances with piece pressure",
            "QueensideAttack": "Queenside attacking chances with expansion",
            "ClosedPositional": "Symmetric pawn structure requiring positional maneuvering",
            "SharpTactical": "Tactical positions with exposed kings and forcing play",
            "LongMiddlegame": "Many pieces remaining, complex strategic battles",
            "EndgameApproaching": "Fewer pieces, simplified positions near endgame",
            "Mixed": "Combination of different strategic themes"
        }
        
        questions = []
        for i, (pos_type_1, pos_type_2) in enumerate(position_pairs):
            questions.append({
                "question_id": i + 1,
                "position_type_1": pos_type_1,
                "position_type_2": pos_type_2,
                "description_1": position_descriptions.get(pos_type_1, f"{pos_type_1} positions"),
                "description_2": position_descriptions.get(pos_type_2, f"{pos_type_2} positions"),
                "your_win_rate_1": f"{len([p for p in position_types_map.get(pos_type_1, []) if p['outcome'] == 'win']) / max(1, len(position_types_map.get(pos_type_1, []))) * 100:.1f}%",
                "your_win_rate_2": f"{len([p for p in position_types_map.get(pos_type_2, []) if p['outcome'] == 'win']) / max(1, len(position_types_map.get(pos_type_2, []))) * 100:.1f}%"
            })
        
        return {
            "username": request.username,
            "total_games_analyzed": player_profile.get("total_games", 0),
            "position_types_found": len(position_types_map),
            "questions": questions
        }
    except Exception as e:
        import traceback
        print(f"Error generating questionnaire: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/submit-preferences")
async def submit_preferences(preferences: QuestionnaireResponse):
    """
    Store player's position preferences and desired opening moves
    """
    global user_preferences
    
    user_preferences = {
        "username": preferences.username,
        "position_preferences": preferences.preferences,
        "desired_first_moves": preferences.desired_first_moves or [],
        "color": preferences.color
    }
    
    print(f"Saved preferences for {preferences.username}")
    print(f"Preferred positions: {preferences.preferences}")
    print(f"Desired first moves: {preferences.desired_first_moves}")
    
    return {
        "message": "Preferences saved successfully",
        "preferences": user_preferences
    }

@app.get("/get-personalized-repertoire")
async def get_personalized_repertoire():
    """
    Generate personalized opening repertoire based on:
    1. Player's position preferences
    2. Desired opening moves
    3. Games where they played those positions well
    """
    global user_preferences, position_types_map, games_data, player_profile
    
    if not user_preferences or not position_types_map or not games_data:
        raise HTTPException(
            status_code=400, 
            detail="Must submit preferences first"
        )
    
    try:
        print("Generating personalized repertoire...")
        
        # Find top preferred position types
        sorted_preferences = sorted(
            user_preferences["position_preferences"].items(),
            key=lambda x: x[1],
            reverse=True
        )
        top_positions = [pos for pos, score in sorted_preferences[:3]]
        
        print(f"Top preferred positions: {top_positions}")
        
        # Find games that feature these position types and desired first moves
        recommended_lines = []
        
        for game_data in games_data:
            white = game_data.get("white", "").lower().strip()
            is_white = white == user_preferences["username"].lower().strip()
            
            moves = game_data.get("moves", [])
            positions = game_data.get("positions", [])
            
            # Check if game starts with desired opening
            matches_opening = False
            for desired_move in user_preferences["desired_first_moves"]:
                if moves and moves[0] == desired_move:
                    matches_opening = True
                    break
            
            if not matches_opening and moves:
                continue
            
            # Check if game reaches preferred position types
            reaches_preferred = False
            for fen in positions:
                classification = PositionClassifier.classify_position(fen)
                if classification.get("position_type") in top_positions:
                    reaches_preferred = True
                    break
            
            if reaches_preferred:
                result = game_data.get("result", "*")
                if result == "1-0":
                    outcome = "win" if is_white else "loss"
                elif result == "0-1":
                    outcome = "loss" if is_white else "win"
                else:
                    outcome = "draw"
                
                recommended_lines.append({
                    "moves": moves[:5],  # First 5 moves
                    "opening": game_data.get("opening", "Unknown"),
                    "positions": positions[:5],
                    "outcome": outcome,
                    "opponent_elo": game_data.get("elo_black") if is_white else game_data.get("elo_white"),
                    "position_types_reached": [
                        PositionClassifier.classify_position(fen).get("position_type", "Unknown")
                        for fen in positions[:5]
                    ]
                })
        
        if not recommended_lines:
            # Fallback: just show games with preferred positions
            for game_data in games_data:
                positions = game_data.get("positions", [])
                for fen in positions:
                    classification = PositionClassifier.classify_position(fen)
                    if classification.get("position_type") in top_positions:
                        recommended_lines.append({
                            "moves": game_data.get("moves", [])[:5],
                            "opening": game_data.get("opening", "Unknown"),
                            "positions": positions[:5],
                            "position_types_reached": [
                                PositionClassifier.classify_position(f).get("position_type", "Unknown")
                                for f in positions[:5]
                            ]
                        })
                        break
                
                if len(recommended_lines) >= 5:
                    break
        
        return {
            "username": user_preferences["username"],
            "desired_first_moves": user_preferences["desired_first_moves"],
            "color": user_preferences["color"],
            "preferred_position_types": top_positions,
            "recommended_lines": recommended_lines[:5],
            "total_recommendations": len(recommended_lines),
            "message": f"Generated {len(recommended_lines)} personalized opening lines combining your preferred positions with {user_preferences['desired_first_moves']}"
        }
    except Exception as e:
        import traceback
        print(f"Error generating repertoire: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
