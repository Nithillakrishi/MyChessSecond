"""
Player profiling and style analysis
"""
from typing import List, Dict, Optional, Tuple
from collections import defaultdict, Counter
import chess.pgn

class PlayerProfiler:
    """Analyze player's style and preferences"""
    
    @staticmethod
    def analyze_player_style(games: List[chess.pgn.Game], username: str) -> Dict:
        """
        Analyze player style from their games
        username: player's username to identify their color in each game
        Returns dict with opening preferences, win rate from player's perspective, etc.
        """
        if not games:
            return {}
        
        username_normalized = username.lower().strip()  # Chess.com usernames are case-insensitive
        
        openings_as_white = Counter()
        openings_as_black = Counter()
        eco_codes = Counter()
        results_from_player_perspective = Counter()  # "win", "loss", "draw"
        avg_opponent_elo = []
        player_elo_white = []
        player_elo_black = []
        first_moves_white = Counter()
        first_moves_black = Counter()
        opening_stats_white = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})
        opening_stats_black = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})
        time_control_stats = defaultdict(lambda: {"games": 0, "wins": 0, "draws": 0, "losses": 0})

        games_as_white = 0
        games_as_black = 0
        _first_headers_printed = False

        for game in games:
            white_player = game.headers.get("White", "").lower().strip()
            black_player = game.headers.get("Black", "").lower().strip()
            result = game.headers.get("Result", "*")
            opening = game.headers.get("Opening", "") or ""
            if not opening or opening == "None":
                # Chess.com PGN uses ECOUrl instead of Opening header
                eco_url = game.headers.get("ECOUrl", "") or ""
                if eco_url:
                    slug = eco_url.rstrip("/").split("/")[-1]
                    opening = slug.replace("-", " ")
                else:
                    # Last resort: use ECO code + site
                    eco = game.headers.get("ECO", "") or ""
                    opening = eco if eco else "Unknown"

            # Print first game's available headers for debugging
            if not _first_headers_printed:
                _first_headers_printed = True
                print(f"[DEBUG] Sample PGN headers: {dict(list(game.headers.items())[:12])}")
                print(f"[DEBUG] Opening resolved to: '{opening}'")
            
            eco = game.headers.get("ECO", "")
            
            # Determine if player is White or Black
            is_white = white_player == username_normalized
            is_black = black_player == username_normalized
            
            if not (is_white or is_black):
                # Not the player's game, skip
                continue
            
            # Count opening based on player color
            if eco:
                eco_codes[eco] += 1
            
            # Track first move made by player
            if game.variations:
                board = game.board()
                first_move = board.san(game.variations[0].move)
                if is_white:
                    first_moves_white[first_move] += 1
                else:
                    first_moves_black[first_move] += 1
            
            # Calculate result from player's perspective
            if result == "1-0":
                player_result = "win" if is_white else "loss"
            elif result == "0-1":
                player_result = "loss" if is_white else "win"
            else:  # "1/2-1/2" or "*"
                player_result = "draw"
            
            results_from_player_perspective[player_result] += 1

            result_key = {"win": "wins", "draw": "draws", "loss": "losses"}[player_result]

            # Classify time control
            tc_raw = game.headers.get("TimeControl", "") or ""
            try:
                base_secs = int(tc_raw.split("+")[0]) if tc_raw and tc_raw != "-" else 0
            except (ValueError, IndexError):
                base_secs = 0
            if base_secs > 0:
                if base_secs < 180:
                    tc_category = "bullet"
                elif base_secs < 600:
                    tc_category = "blitz"
                elif base_secs < 1800:
                    tc_category = "rapid"
                else:
                    tc_category = "classical"
                time_control_stats[tc_category]["games"] += 1
                time_control_stats[tc_category][result_key] += 1

            # Track W/D/L per opening name
            if opening and opening != "Unknown":
                stats = opening_stats_white if is_white else opening_stats_black
                stats[opening]["games"] += 1
                stats[opening][result_key] += 1

            # Track ELO and openings
            if is_white:
                games_as_white += 1
                openings_as_white[opening] += 1
                
                white_elo = game.headers.get("WhiteElo")
                black_elo = game.headers.get("BlackElo")
                
                if white_elo:
                    try:
                        player_elo_white.append(int(white_elo))
                    except:
                        pass
                if black_elo:
                    try:
                        avg_opponent_elo.append(int(black_elo))
                    except:
                        pass
            else:  # is_black
                games_as_black += 1
                openings_as_black[opening] += 1
                
                white_elo = game.headers.get("WhiteElo")
                black_elo = game.headers.get("BlackElo")
                
                if black_elo:
                    try:
                        player_elo_black.append(int(black_elo))
                    except:
                        pass
                if white_elo:
                    try:
                        avg_opponent_elo.append(int(white_elo))
                    except:
                        pass
        
        print(f"[DEBUG] Unique openings as White: {len(opening_stats_white)}, as Black: {len(opening_stats_black)}")
        if opening_stats_white:
            top3 = list(opening_stats_white.items())[:3]
            print(f"[DEBUG] Top 3 white openings: {[(k, v['games']) for k, v in top3]}")

        # Calculate statistics
        wins = results_from_player_perspective.get("win", 0)
        losses = results_from_player_perspective.get("loss", 0)
        draws = results_from_player_perspective.get("draw", 0)
        total = wins + losses + draws
        
        # Combine first moves from both colors for top favorite moves
        all_first_moves = Counter()
        all_first_moves.update(first_moves_white)
        all_first_moves.update(first_moves_black)
        
        # Combine openings
        all_openings = Counter()
        all_openings.update(openings_as_white)
        all_openings.update(openings_as_black)
        
        avg_opponent_elo_val = sum(avg_opponent_elo) / len(avg_opponent_elo) if avg_opponent_elo else 0
        avg_elo_white = sum(player_elo_white) / len(player_elo_white) if player_elo_white else 0
        avg_elo_black = sum(player_elo_black) / len(player_elo_black) if player_elo_black else 0

        def build_opening_stats(stats_dict, top_n=6):
            rows = []
            for name, s in sorted(stats_dict.items(), key=lambda x: x[1]["games"], reverse=True)[:top_n]:
                total = s["games"]
                win_rate = round(s["wins"] / total * 100) if total > 0 else 0
                rows.append({
                    "name": name,
                    "games": total,
                    "wins": s["wins"],
                    "draws": s["draws"],
                    "losses": s["losses"],
                    "win_rate": win_rate,
                })
            return rows

        return {
            "total_games": total,
            "win_rate": wins / total if total > 0 else 0,
            "loss_rate": losses / total if total > 0 else 0,
            "draw_rate": draws / total if total > 0 else 0,
            "wins": wins,
            "losses": losses,
            "draws": draws,
            "preferred_openings": dict(all_openings.most_common(5)),
            "openings_as_white": dict(openings_as_white.most_common(5)),
            "openings_as_black": dict(openings_as_black.most_common(5)),
            "eco_codes": dict(eco_codes.most_common(5)),
            "first_moves": dict(all_first_moves.most_common(5)),
            "first_moves_white": dict(first_moves_white.most_common(5)),
            "first_moves_black": dict(first_moves_black.most_common(5)),
            "avg_elo_white": avg_elo_white,
            "avg_elo_black": avg_elo_black,
            "avg_opponent_elo": avg_opponent_elo_val,
            "total_games_as_white": games_as_white,
            "total_games_as_black": games_as_black,
            "username": username,
            "top_openings_white": build_opening_stats(opening_stats_white),
            "top_openings_black": build_opening_stats(opening_stats_black),
            "time_controls": {
                k: {
                    "games": v["games"],
                    "wins": v["wins"],
                    "draws": v["draws"],
                    "losses": v["losses"],
                    "win_rate": round(v["wins"] / v["games"] * 100) if v["games"] > 0 else 0,
                }
                for k, v in time_control_stats.items()
            },
        }
    
    @staticmethod
    def get_comfortable_positions(games: List[chess.pgn.Game], username: str, min_depth: int = 10) -> Dict:
        """
        Find positions where player feels comfortable
        (positions they reach after opening and play well)
        username: player's username to identify their perspective
        """
        position_outcomes = defaultdict(list)
        username_normalized = username.lower().strip()
        
        for game in games:
            white_player = game.headers.get("White", "").lower().strip()
            black_player = game.headers.get("Black", "").lower().strip()
            
            # Determine if player is White or Black
            is_white = white_player == username_normalized
            is_black = black_player == username_normalized
            
            if not (is_white or is_black):
                continue
            
            board = chess.Board()
            node = game
            move_count = 0
            
            while node.variations and move_count < min_depth:
                move = node.variations[0].move
                board.push(move)
                move_count += 1
                node = node.variations[0]
            
            # Record the position and game outcome from player's perspective
            result = game.headers.get("Result", "*")
            
            # Convert result to player's perspective
            if result == "1-0":
                player_result = "1-0" if is_white else "0-1"
            elif result == "0-1":
                player_result = "0-1" if is_white else "1-0"
            else:
                player_result = result
            
            position_outcomes[board.fen()].append(player_result)
        
        # Analyze which positions have good outcomes for the player
        comfortable_positions = {}
        for fen, outcomes in position_outcomes.items():
            wins = outcomes.count("1-0") + 0.5 * outcomes.count("1/2-1/2")
            win_rate = wins / len(outcomes)
            
            if win_rate >= 0.5 and len(outcomes) >= 2:  # At least 50% win rate and 2+ games
                comfortable_positions[fen] = {
                    "win_rate": win_rate,
                    "games": len(outcomes),
                    "outcomes": outcomes
                }
        
        # Sort by win rate
        sorted_positions = sorted(comfortable_positions.items(), 
                                 key=lambda x: x[1]["win_rate"], 
                                 reverse=True)
        
        return dict(sorted_positions[:10])  # Return top 10
    
    @staticmethod
    def recommend_opening(profile: Dict, available_first_moves: List[str]) -> Optional[str]:
        """
        Recommend an opening based on player profile
        """
        preferred_first_moves = profile.get("first_moves", {})
        
        # Find the most played first move among available options
        for move in available_first_moves:
            if move in preferred_first_moves:
                return move
        
        # If none match, return the most common opening
        if preferred_first_moves:
            return list(preferred_first_moves.keys())[0]
        
        return None
