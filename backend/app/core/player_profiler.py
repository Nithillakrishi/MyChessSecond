"""
Player profiling and style analysis
"""
from typing import List, Dict, Optional, Tuple
from collections import defaultdict, Counter
import chess.pgn

class PlayerProfiler:
    """Analyze player's style and preferences"""
    
    @staticmethod
    def analyze_player_style(games: List[chess.pgn.Game]) -> Dict:
        """
        Analyze player style from their games
        Returns dict with opening preferences, win rate, favorite positions, etc.
        """
        if not games:
            return {}
        
        openings = Counter()
        eco_codes = Counter()
        results = Counter()
        avg_elo = {"white": [], "black": []}
        first_moves = Counter()
        
        for game in games:
            # Count openings
            opening = game.headers.get("Opening", "Unknown")
            openings[opening] += 1
            
            # Count ECO codes
            eco = game.headers.get("ECO", "")
            if eco:
                eco_codes[eco] += 1
            
            # Count results
            result = game.headers.get("Result", "*")
            results[result] += 1
            
            # Track ELO ratings
            white_elo = game.headers.get("WhiteElo")
            black_elo = game.headers.get("BlackElo")
            if white_elo:
                try:
                    avg_elo["white"].append(int(white_elo))
                except:
                    pass
            if black_elo:
                try:
                    avg_elo["black"].append(int(black_elo))
                except:
                    pass
            
            # Track first moves
            if game.variations:
                first_move = game.variations[0].move.uci()
                first_moves[first_move] += 1
        
        # Calculate win rate
        wins = results.get("1-0", 0)
        losses = results.get("0-1", 0)
        draws = results.get("1/2-1/2", 0)
        total = wins + losses + draws
        
        avg_white_elo = sum(avg_elo["white"]) / len(avg_elo["white"]) if avg_elo["white"] else 0
        avg_black_elo = sum(avg_elo["black"]) / len(avg_elo["black"]) if avg_elo["black"] else 0
        
        return {
            "total_games": total,
            "win_rate": wins / total if total > 0 else 0,
            "loss_rate": losses / total if total > 0 else 0,
            "draw_rate": draws / total if total > 0 else 0,
            "preferred_openings": dict(openings.most_common(5)),
            "eco_codes": dict(eco_codes.most_common(5)),
            "first_moves": dict(first_moves.most_common(5)),
            "avg_elo_white": avg_white_elo,
            "avg_elo_black": avg_black_elo,
            "total_games_as_white": sum(1 for g in games if g.headers.get("White") == ""),
            "total_games_as_black": sum(1 for g in games if g.headers.get("Black") == "")
        }
    
    @staticmethod
    def get_comfortable_positions(games: List[chess.pgn.Game], min_depth: int = 10) -> Dict:
        """
        Find positions where player feels comfortable
        (positions they reach after opening and play well)
        """
        position_outcomes = defaultdict(list)
        
        for game in games:
            board = chess.Board()
            node = game
            move_count = 0
            
            while node.variations and move_count < min_depth:
                move = node.variations[0].move
                board.push(move)
                move_count += 1
                node = node.variations[0]
            
            # Record the position and game outcome
            result = game.headers.get("Result", "*")
            position_outcomes[board.fen()].append(result)
        
        # Analyze which positions have good outcomes
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
