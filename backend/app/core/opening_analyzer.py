"""
Analyze opening positions and generate candidate positions
"""
from typing import List, Dict, Tuple, Optional
import chess
import random
from collections import defaultdict, Counter

class OpeningAnalyzer:
    """Analyze and generate opening positions"""
    
    @staticmethod
    def find_matching_positions(games_data: List[Dict], first_moves: List[str], count: int = 10) -> List[Dict]:
        """
        Find positions from games that match the given first move sequence
        Returns top positions grouped in pairs for comparison
        
        Args:
            games_data: List of processed game data with positions
            first_moves: List of moves (e.g., ["e2e4", "c7c5"])
            count: Number of positions to return (default 10, grouped as 5 pairs)
        """
        matching_positions = []
        
        for game_data in games_data:
            positions = game_data.get("positions", [])
            moves = game_data.get("moves", [])
            
            # Check if game starts with the requested first moves
            if len(moves) >= len(first_moves):
                if moves[:len(first_moves)] == first_moves:
                    # Get the next position after the first moves
                    next_position_index = len(first_moves)
                    if next_position_index < len(positions):
                        matching_positions.append({
                            "fen": positions[next_position_index],
                            "moves": moves[:next_position_index + 1],
                            "game_data": game_data,
                            "depth": len(first_moves)
                        })
        
        # Remove duplicates and limit to count
        unique_positions = {pos["fen"]: pos for pos in matching_positions}
        positions_list = list(unique_positions.values())[:count]
        
        # Group into pairs for comparison
        pairs = []
        for i in range(0, len(positions_list), 2):
            if i + 1 < len(positions_list):
                pairs.append({
                    "position_1": positions_list[i],
                    "position_2": positions_list[i + 1]
                })
            else:
                # If odd number, create a single position comparison
                pairs.append({
                    "position_1": positions_list[i],
                    "position_2": None
                })
        
        return pairs
    
    @staticmethod
    def get_position_stats(positions: List[str], evaluations: Dict[str, Dict]) -> Dict:
        """
        Calculate statistics for a set of positions
        Returns average evaluation, win rates, etc.
        """
        if not positions:
            return {}
        
        evals = []
        for fen in positions:
            if fen in evaluations:
                eval_data = evaluations[fen].get("eval")
                if eval_data and isinstance(eval_data, dict):
                    # Extract centipawn value
                    if "value" in eval_data:
                        evals.append(eval_data["value"] / 100)  # Convert to pawns
        
        if not evals:
            return {}
        
        return {
            "avg_eval": sum(evals) / len(evals),
            "min_eval": min(evals),
            "max_eval": max(evals),
            "count": len(evals)
        }
    
    @staticmethod
    def compare_positions(position_1: str, position_2: str, evaluations: Dict) -> Dict:
        """Compare two positions"""
        eval_1 = evaluations.get(position_1, {}).get("eval")
        eval_2 = evaluations.get(position_2, {}).get("eval")
        
        return {
            "position_1": position_1,
            "position_2": position_2,
            "eval_1": eval_1,
            "eval_2": eval_2,
            "better": "position_1" if (eval_1 and eval_2 and eval_1.get("value", 0) > eval_2.get("value", 0)) else "position_2"
        }
