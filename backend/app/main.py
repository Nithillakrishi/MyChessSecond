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
player_profile = None
games_data = None
position_types_map = None
game_stats_by_type = None  # game-level win/draw/loss per position type
user_preferences = None

def _fen_key(fen: str) -> str:
    """FEN comparison key ignoring half-move clock and full-move number."""
    return " ".join(fen.strip().split()[:4])

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

class CoachPositionRequest(BaseModel):
    moves: List[str]  # SAN move history from chess.js, e.g. ["e4", "e5", "Nf3"]

class CoachLinesRequest(BaseModel):
    moves: List[str]
    color: str  # "white" or "black" — the user's playing color

@app.post("/coach/position")
async def coach_position(request: CoachPositionRequest):
    global user_preferences, games_data, game_stats_by_type
    import chess as chess_lib

    board = chess_lib.Board()
    for san in request.moves:
        try:
            board.push_san(san)
        except Exception:
            break

    current_fen = board.fen()
    current_type = PositionClassifier.classify_position(current_fen).get("position_type", "Mixed")

    if not user_preferences:
        return {"total_games": 0, "wins": 0, "losses": 0, "draws": 0,
                "current_position_type": current_type, "recommended_moves": []}

    position_preferences = user_preferences.get("position_preferences", {})
    username = user_preferences.get("username", "").lower()

    # Game-level stats per position type (computed at questionnaire time, no inflation)
    type_stats: Dict[str, Dict] = game_stats_by_type or {}
    cur_stats = type_stats.get(current_type, {"wins": 0, "draws": 0, "losses": 0, "total": 0})

    # Preferred types sorted by preference score
    top_preferred = [p for p, s in sorted(position_preferences.items(), key=lambda x: x[1], reverse=True) if s > 0]

    # Step 1: find moves the user actually played from this exact position in their games
    # This gives historically grounded suggestions with real win-rate backing.
    history_moves: Dict[str, Dict] = {}  # san -> {wins, draws, losses}
    target_key = _fen_key(current_fen)
    initial_key = _fen_key(chess_lib.Board().fen())
    is_start = target_key == initial_key

    if games_data:
        for game in games_data:
            g_moves = game.get("moves", [])
            g_positions = game.get("positions", [])
            result = game.get("result", "*")
            is_white = game.get("white", "").lower() == username
            if result == "1-0": outcome = "win" if is_white else "loss"
            elif result == "0-1": outcome = "loss" if is_white else "win"
            else: outcome = "draw"

            next_san = None
            if is_start and g_moves:
                next_san = g_moves[0]
            else:
                for i, pfn in enumerate(g_positions):
                    if _fen_key(pfn) == target_key and i + 1 < len(g_moves):
                        next_san = g_moves[i + 1]
                        break

            if not next_san:
                continue
            if next_san not in history_moves:
                history_moves[next_san] = {"wins": 0, "draws": 0, "losses": 0}
            history_moves[next_san][outcome + "s"] += 1

    # Step 2: for each legal move classify the resulting position type
    move_future_type: Dict[str, str] = {}
    for move in list(board.legal_moves):
        tb = board.copy()
        tb.push(move)
        san = board.san(move)
        move_future_type[san] = PositionClassifier.classify_position(tb.fen()).get("position_type", "Mixed")

    # Build recommendations — prefer historically played moves that lead to preferred types
    recommendations = []
    seen_types: set = set()

    # Priority 1: moves from user history that lead to a preferred type
    for san, hstats in sorted(history_moves.items(),
                               key=lambda x: x[1]["wins"], reverse=True):
        future_type = move_future_type.get(san, "Mixed")
        if future_type in top_preferred and future_type not in seen_types:
            total_h = hstats["wins"] + hstats["draws"] + hstats["losses"]
            type_s = type_stats.get(future_type, {"wins": 0, "total": 1, "win_rate": 0})
            recommendations.append({
                "move": san,
                "style": future_type,
                "win_rate": f"{type_s.get('win_rate', 0):.0f}%",
                "your_wins": type_s.get("wins", 0),
                "total_games_in_type": type_s.get("total", 0),
                "preference_score": position_preferences.get(future_type, 0),
                "times_you_played": total_h,
                "source": "your_history"
            })
            seen_types.add(future_type)

    # Priority 2: legal moves (not from history) that lead to a preferred type
    for san, future_type in move_future_type.items():
        if future_type in top_preferred and future_type not in seen_types:
            type_s = type_stats.get(future_type, {"wins": 0, "total": 0, "win_rate": 0})
            if type_s.get("total", 0) == 0:
                continue  # skip if no data
            recommendations.append({
                "move": san,
                "style": future_type,
                "win_rate": f"{type_s.get('win_rate', 0):.0f}%",
                "your_wins": type_s.get("wins", 0),
                "total_games_in_type": type_s.get("total", 0),
                "preference_score": position_preferences.get(future_type, 0),
                "times_you_played": 0,
                "source": "new_territory"
            })
            seen_types.add(future_type)

    recommendations.sort(key=lambda x: (x["preference_score"], float(x["win_rate"].rstrip("%"))), reverse=True)

    return {
        "total_games": cur_stats.get("total", 0),
        "wins": cur_stats.get("wins", 0),
        "losses": cur_stats.get("losses", 0),
        "draws": cur_stats.get("draws", 0),
        "current_position_type": current_type,
        "recommended_moves": recommendations[:3]
    }

@app.post("/coach/lines")
async def coach_lines(request: CoachLinesRequest):
    """
    Turn-aware coaching:
    - User's turn  → 3 recommended lines from game history (user_move, opp_reply, user_followup)
    - Opponent turn → popular opponent responses the user has faced, with user win rates
    """
    global user_preferences, games_data, game_stats_by_type
    import chess as chess_lib

    board = chess_lib.Board()
    for san in request.moves:
        try:
            board.push_san(san)
        except Exception:
            break

    current_fen = board.fen()
    target_key = _fen_key(current_fen)
    initial_key = _fen_key(chess_lib.Board().fen())
    is_start = target_key == initial_key

    is_white_to_move = board.turn == chess_lib.WHITE
    user_plays_white = request.color.lower() == "white"
    is_user_turn = (is_white_to_move == user_plays_white)

    username = (user_preferences or {}).get("username", "").lower()
    type_stats = game_stats_by_type or {}

    if not games_data:
        return {"is_user_turn": is_user_turn, "lines": [], "opponent_moves": []}

    # --- Helper: find next move index in a game at the target position ---
    def find_idx(g_moves, g_positions):
        if is_start and g_moves:
            return 0
        for i, pfn in enumerate(g_positions):
            if _fen_key(pfn) == target_key and i + 1 < len(g_moves):
                return i + 1
        return None

    def outcome_key(result, is_white_in_game):
        if result == "1-0": return "wins" if is_white_in_game else "losses"
        if result == "0-1": return "losses" if is_white_in_game else "wins"
        return "draws"

    if is_user_turn:
        # Build move tree: user_move → opp_response → user_followup → stats
        move_tree: Dict = {}
        for gd in games_data:
            g_moves = gd.get("moves", [])
            g_positions = gd.get("positions", [])
            oc = outcome_key(gd.get("result", "*"), gd.get("white", "").lower() == username)
            idx = find_idx(g_moves, g_positions)
            if idx is None or idx >= len(g_moves):
                continue

            um = g_moves[idx]
            om = g_moves[idx + 1] if idx + 1 < len(g_moves) else None
            uf = g_moves[idx + 2] if idx + 2 < len(g_moves) else None

            if um not in move_tree:
                move_tree[um] = {"wins": 0, "draws": 0, "losses": 0, "opp": {}}
            move_tree[um][oc] += 1

            if om:
                if om not in move_tree[um]["opp"]:
                    move_tree[um]["opp"][om] = {"wins": 0, "draws": 0, "losses": 0, "followup": {}}
                move_tree[um]["opp"][om][oc] += 1
                if uf:
                    fu = move_tree[um]["opp"][om]["followup"]
                    if uf not in fu:
                        fu[uf] = {"wins": 0, "draws": 0, "losses": 0}
                    fu[uf][oc] += 1

        lines = []
        for um, data in sorted(move_tree.items(), key=lambda x: x[1]["wins"], reverse=True)[:3]:
            total = data["wins"] + data["draws"] + data["losses"]
            win_rate = int(data["wins"] / total * 100) if total > 0 else 0

            best_opp, best_fu = None, None
            if data["opp"]:
                best_opp = max(data["opp"].items(), key=lambda x: sum(v for k, v in x[1].items() if k != "followup"))[0]
                fu_map = data["opp"][best_opp]["followup"]
                if fu_map:
                    best_fu = max(fu_map.items(), key=lambda x: x[1]["wins"])[0]

            future_type = "Mixed"
            try:
                tb = board.copy()
                tb.push_san(um)
                future_type = PositionClassifier.classify_position(tb.fen()).get("position_type", "Mixed")
            except Exception:
                pass

            ts = type_stats.get(future_type, {"win_rate": 0})
            line_moves = [m for m in [um, best_opp, best_fu] if m]

            lines.append({
                "moves": line_moves,
                "target_type": future_type,
                "win_rate": f"{win_rate}%",
                "games_played": total,
                "structure_win_rate": f"{ts.get('win_rate', 0):.0f}%",
            })

        return {"is_user_turn": True, "lines": lines, "opponent_moves": []}

    else:
        # Opponent's turn — collect opponent moves from game history
        opp_stats: Dict = {}
        for gd in games_data:
            g_moves = gd.get("moves", [])
            g_positions = gd.get("positions", [])
            oc = outcome_key(gd.get("result", "*"), gd.get("white", "").lower() == username)
            idx = find_idx(g_moves, g_positions)
            if idx is None or idx >= len(g_moves):
                continue
            om = g_moves[idx]
            if om not in opp_stats:
                opp_stats[om] = {"wins": 0, "draws": 0, "losses": 0}
            opp_stats[om][oc] += 1

        opp_moves = []
        for san, stats in sorted(opp_stats.items(), key=lambda x: sum(x[1].values()), reverse=True)[:6]:
            total = stats["wins"] + stats["draws"] + stats["losses"]
            opp_moves.append({
                "san": san,
                "games": total,
                "user_win_rate": f"{int(stats['wins'] / total * 100) if total > 0 else 0}%",
                "wins": stats["wins"], "draws": stats["draws"], "losses": stats["losses"],
            })

        return {"is_user_turn": False, "lines": [], "opponent_moves": opp_moves}

@app.get("/opening-explorer")
async def opening_explorer(fen: str):
    """
    Global opening explorer using ChessDB public database.
    Returns popular moves with engine score and winrate from millions of games.
    """
    import urllib.request
    import urllib.parse

    encoded = urllib.parse.quote(fen)
    url = f"https://www.chessdb.cn/cdb.php?action=queryall&board={encoded}&json=1"
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
            "Accept-Encoding": "identity",
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())

        if data.get("status") != "ok" or not data.get("moves"):
            return {"moves": [], "source": "chessdb"}

        RANK_LABEL = {2: "Best", 1: "Good", 0: "Inaccurate"}
        RANK_COLOR = {2: "best", 1: "good", 0: "weak"}

        moves = []
        for m in data["moves"][:8]:
            rank = int(m.get("rank", 1))
            note = m.get("note", "")
            # note format: "! (29-13)" → extract annotation symbol
            annotation = note.split(" ")[0] if note else ""
            moves.append({
                "san":        m.get("san", "?"),
                "uci":        m.get("uci", ""),
                "score":      int(m.get("score", 0)),
                "winrate":    float(m.get("winrate", 50)),
                "rank":       rank,
                "rank_label": RANK_LABEL.get(rank, ""),
                "rank_class": RANK_COLOR.get(rank, "good"),
                "annotation": annotation,
            })
        return {"moves": moves, "source": "chessdb"}

    except Exception as e:
        return {"moves": [], "source": "chessdb", "error": str(e)}

@app.get("/explorer/moves")
async def explorer_proxy(fen: str):
    """Return moves played from this FEN position in the user's own game history."""
    global games_data, user_preferences
    import chess as chess_lib

    if not games_data:
        return {"moves": [], "source": "no_data"}

    username = (user_preferences or {}).get("username", "").lower()
    target_key = _fen_key(fen)
    initial_key = _fen_key(chess_lib.Board().fen())
    is_start = target_key == initial_key

    move_stats: Dict[str, Dict] = {}

    for game in games_data:
        g_moves = game.get("moves", [])
        g_positions = game.get("positions", [])
        result = game.get("result", "*")

        next_san = None
        if is_start and g_moves:
            next_san = g_moves[0]
        else:
            for i, pfn in enumerate(g_positions):
                if _fen_key(pfn) == target_key and i + 1 < len(g_moves):
                    next_san = g_moves[i + 1]
                    break

        if not next_san:
            continue

        if next_san not in move_stats:
            move_stats[next_san] = {"white": 0, "draws": 0, "black": 0}

        if result == "1-0":
            move_stats[next_san]["white"] += 1
        elif result == "0-1":
            move_stats[next_san]["black"] += 1
        else:
            move_stats[next_san]["draws"] += 1

    moves_list = [
        {"san": m, "white": s["white"], "draws": s["draws"], "black": s["black"]}
        for m, s in move_stats.items()
    ]
    moves_list.sort(key=lambda x: x["white"] + x["draws"] + x["black"], reverse=True)

    return {"moves": moves_list[:6], "source": "your_games"}


@app.get("/chess-explorer")
async def chess_explorer(fen: str):
    """
    Proxy ChessDB (free, no-auth) for opening statistics.
    Returns moves sorted by win-rate with computer score and rank label.
    ChessDB win-rate is from the perspective of the side to move.
    """
    import urllib.request
    import urllib.parse

    url = f"https://www.chessdb.cn/cdb.php?action=queryall&board={urllib.parse.quote(fen)}&json=1"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ChessSecond/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        return {"moves": [], "error": str(e)}

    if data.get("status") != "ok":
        return {"moves": [], "error": data.get("status", "unknown")}

    rank_labels = {2: "Excellent", 1: "Good", 0: "Dubious"}
    rank_symbols = {2: "!", 1: "⊙", 0: "?"}

    moves = []
    for m in data.get("moves", []):
        try:
            winrate = float(m.get("winrate", 50))
            score_cp = int(m.get("score", 0))
            rank = int(m.get("rank", 1))
            moves.append({
                "san": m["san"],
                "uci": m["uci"],
                "winrate": round(winrate, 1),       # win% for side to move
                "score_cp": score_cp,                # centipawns, side-to-move perspective
                "rank": rank,
                "rank_label": rank_labels.get(rank, ""),
                "rank_symbol": rank_symbols.get(rank, ""),
            })
        except (KeyError, ValueError):
            continue

    # Sort: excellent first, then by winrate descending
    moves.sort(key=lambda x: (x["rank"], x["winrate"]), reverse=True)
    return {"moves": moves[:8]}


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
        
        player_profile = PlayerProfiler.analyze_player_style(games, username="TestPlayer1")
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
    global position_types_map, game_stats_by_type, games_data, player_profile

    if not games_data or not player_profile:
        raise HTTPException(status_code=400, detail="Must analyze profile first")

    try:
        print(f"Generating questionnaire for {request.username}...")
        username_lc = request.username.lower()

        # Classify all positions by type (position-level map)
        position_types_map = PositionClassifier.classify_games_by_position_type(
            games_data, request.username
        )
        print(f"Classified {sum(len(p) for p in position_types_map.values())} positions into {len(position_types_map)} types")

        # Build game-level win/draw/loss stats per position type so the coach
        # shows accurate percentages (each game counted once per type it visits).
        _game_stats: Dict[str, Dict] = {}
        for game_data in games_data:
            positions = game_data.get("positions", [])
            result = game_data.get("result", "*")
            is_white = game_data.get("white", "").lower() == username_lc
            if result == "1-0":   outcome = "wins" if is_white else "losses"
            elif result == "0-1": outcome = "losses" if is_white else "wins"
            else:                  outcome = "draws"

            types_in_game: set = set()
            for fen in positions:
                p_type = PositionClassifier.classify_position(fen).get("position_type", "Mixed")
                types_in_game.add(p_type)

            for p_type in types_in_game:
                if p_type not in _game_stats:
                    _game_stats[p_type] = {"wins": 0, "draws": 0, "losses": 0, "total": 0}
                _game_stats[p_type]["total"] += 1
                _game_stats[p_type][outcome] += 1

        for p_type, s in _game_stats.items():
            s["win_rate"] = (s["wins"] / s["total"] * 100) if s["total"] > 0 else 0
        game_stats_by_type = _game_stats

        # Find contrasting position pairs for questionnaire
        position_pairs = PositionClassifier.find_best_position_pairs(position_types_map, num_pairs=5)
        if not position_pairs:
            raise HTTPException(status_code=400, detail="Not enough position types to generate questionnaire")

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
            s1 = game_stats_by_type.get(pos_type_1, {"win_rate": 0})
            s2 = game_stats_by_type.get(pos_type_2, {"win_rate": 0})
            questions.append({
                "question_id": i + 1,
                "position_type_1": pos_type_1,
                "position_type_2": pos_type_2,
                "description_1": position_descriptions.get(pos_type_1, f"{pos_type_1} positions"),
                "description_2": position_descriptions.get(pos_type_2, f"{pos_type_2} positions"),
                "your_win_rate_1": f"{s1['win_rate']:.1f}%",
                "your_win_rate_2": f"{s2['win_rate']:.1f}%",
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
