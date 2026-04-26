"""
Stockfish integration for position evaluation
"""
from stockfish import Stockfish
from typing import Dict, Optional, List
import chess

class PositionEvaluator:
    """Evaluate positions using Stockfish"""
    
    def __init__(self, stockfish_path: Optional[str] = None, depth: int = 20):
        """
        Initialize Stockfish evaluator
        stockfish_path: path to stockfish binary (None = auto-detect)
        depth: search depth for evaluation
        """
        try:
            if stockfish_path:
                self.engine = Stockfish(path=stockfish_path, depth=depth)
            else:
                self.engine = Stockfish(depth=depth)
            self.depth = depth
        except Exception as e:
            print(f"Warning: Could not initialize Stockfish: {e}")
            self.engine = None
    
    def evaluate_fen(self, fen: str) -> Optional[Dict]:
        """
        Evaluate a position given in FEN notation
        Returns dict with evaluation and best moves
        """
        if not self.engine:
            return None
        
        try:
            self.engine.set_fen_position(fen)
            evaluation = self.engine.get_evaluation()
            best_moves = self.engine.get_top_moves(5)
            
            return {
                "eval": evaluation,
                "best_moves": best_moves,
                "fen": fen
            }
        except Exception as e:
            print(f"Error evaluating position: {e}")
            return None
    
    def evaluate_move_sequence(self, moves: List[str]) -> Optional[List[Dict]]:
        """
        Evaluate a sequence of moves
        Returns list of evaluations at each ply
        """
        if not self.engine:
            return None
        
        try:
            board = chess.Board()
            evaluations = []
            
            for move_uci in moves:
                move = chess.Move.from_uci(move_uci)
                board.push(move)
                
                self.engine.set_fen_position(board.fen())
                evaluation = self.engine.get_evaluation()
                
                evaluations.append({
                    "move": move_uci,
                    "fen": board.fen(),
                    "eval": evaluation
                })
            
            return evaluations
        except Exception as e:
            print(f"Error evaluating move sequence: {e}")
            return None
    
    def get_top_moves(self, fen: str, count: int = 5) -> Optional[List]:
        """Get top moves for a position"""
        if not self.engine:
            return None
        
        try:
            self.engine.set_fen_position(fen)
            return self.engine.get_top_moves(count)
        except Exception as e:
            print(f"Error getting top moves: {e}")
            return None
    
    def close(self):
        """Close Stockfish engine"""
        if self.engine:
            self.engine.__del__()
