"""
Classify chess positions by strategic characteristics
Determines position types like: Kingside Fianchetto, Central Control, etc.
"""
import chess
from typing import Dict, List, Tuple
from collections import Counter

class PositionClassifier:
    """Classify positions by their strategic characteristics"""
    
    @staticmethod
    def classify_position(fen: str) -> Dict:
        """
        Classify a position by its strategic features
        Returns dict with position characteristics
        """
        try:
            board = chess.Board(fen)
        except:
            return {}
        
        classification = {
            "pawn_structure": PositionClassifier._analyze_pawn_structure(board),
            "piece_activity": PositionClassifier._analyze_piece_activity(board),
            "king_safety": PositionClassifier._analyze_king_safety(board),
            "space_control": PositionClassifier._analyze_space_control(board),
            "position_type": ""  # Will be filled below
        }
        
        # Determine primary position type based on characteristics
        classification["position_type"] = PositionClassifier._determine_position_type(
            board, classification
        )
        
        return classification
    
    @staticmethod
    def _analyze_pawn_structure(board: chess.Board) -> Dict:
        """Analyze pawn structure of the position"""
        white_pawns = board.pieces(chess.PAWN, chess.WHITE)
        black_pawns = board.pieces(chess.PAWN, chess.BLACK)
        
        white_pawn_files = set()
        black_pawn_files = set()
        
        for square in white_pawns:
            white_pawn_files.add(chess.square_file(square))
        
        for square in black_pawns:
            black_pawn_files.add(chess.square_file(square))
        
        # Check for fianchetto (bishop on g-file, pawn on g3/g6)
        has_white_fianchetto = (
            board.piece_at(chess.G2) == chess.Piece(chess.PAWN, chess.WHITE) and
            board.piece_at(chess.G3) == chess.Piece(chess.PAWN, chess.WHITE)
        ) or (
            board.piece_at(chess.G1) == chess.Piece(chess.BISHOP, chess.WHITE)
        ) or (
            board.piece_at(chess.G2) == chess.Piece(chess.BISHOP, chess.WHITE)
        )
        
        has_black_fianchetto = (
            board.piece_at(chess.G7) == chess.Piece(chess.PAWN, chess.BLACK) and
            board.piece_at(chess.G6) == chess.Piece(chess.PAWN, chess.BLACK)
        ) or (
            board.piece_at(chess.G8) == chess.Piece(chess.BISHOP, chess.BLACK)
        ) or (
            board.piece_at(chess.G7) == chess.Piece(chess.BISHOP, chess.BLACK)
        )
        
        return {
            "white_pawn_files": len(white_pawn_files),
            "black_pawn_files": len(black_pawn_files),
            "white_fianchetto": has_white_fianchetto,
            "black_fianchetto": has_black_fianchetto,
            "pawn_symmetry": "symmetric" if white_pawn_files == black_pawn_files else "asymmetric"
        }
    
    @staticmethod
    def _analyze_piece_activity(board: chess.Board) -> Dict:
        """Analyze piece centralization and activity"""
        white_pieces = (
            board.pieces(chess.KNIGHT, chess.WHITE) |
            board.pieces(chess.BISHOP, chess.WHITE) |
            board.pieces(chess.ROOK, chess.WHITE) |
            board.pieces(chess.QUEEN, chess.WHITE)
        )
        
        black_pieces = (
            board.pieces(chess.KNIGHT, chess.BLACK) |
            board.pieces(chess.BISHOP, chess.BLACK) |
            board.pieces(chess.ROOK, chess.BLACK) |
            board.pieces(chess.QUEEN, chess.BLACK)
        )
        
        def centrality_score(squares):
            total = 0
            for sq in squares:
                file = chess.square_file(sq)
                rank = chess.square_rank(sq)
                # Closer to center = higher score
                dist_from_center = abs(file - 3.5) + abs(rank - 3.5)
                total += 8 - dist_from_center
            return total / len(squares) if squares else 0
        
        return {
            "white_centralization": centrality_score(white_pieces),
            "black_centralization": centrality_score(black_pieces),
            "white_piece_count": len(white_pieces),
            "black_piece_count": len(black_pieces)
        }
    
    @staticmethod
    def _analyze_king_safety(board: chess.Board) -> Dict:
        """Analyze king safety"""
        white_king_square = board.king(chess.WHITE)
        black_king_square = board.king(chess.BLACK)
        
        def king_safety_score(king_sq, color):
            if king_sq is None:
                return 0
            
            file = chess.square_file(king_sq)
            rank = chess.square_rank(king_sq)
            
            # King in corners (fianchettoed) is safer
            if (color == chess.WHITE and rank <= 1) or (color == chess.BLACK and rank >= 6):
                if file in [0, 7]:  # a-file or h-file
                    return 0.8  # Good castled position
            
            # King in center is more exposed
            if 2 <= file <= 5 and 2 <= rank <= 5:
                return 0.3  # Exposed king
            
            return 0.5
        
        return {
            "white_king_safety": king_safety_score(white_king_square, chess.WHITE),
            "black_king_safety": king_safety_score(black_king_square, chess.BLACK),
            "white_king_file": chess.square_file(white_king_square) if white_king_square else -1,
            "black_king_file": chess.square_file(black_king_square) if black_king_square else -1
        }
    
    @staticmethod
    def _analyze_space_control(board: chess.Board) -> Dict:
        """Analyze space control"""
        white_attacks = board.attacks_mask(chess.WHITE)
        black_attacks = board.attacks_mask(chess.BLACK)
        
        # Count controlled squares
        white_controlled = bin(white_attacks).count('1')
        black_controlled = bin(black_attacks).count('1')
        
        return {
            "white_space": white_controlled,
            "black_space": black_controlled,
            "space_advantage": "white" if white_controlled > black_controlled else "black"
        }
    
    @staticmethod
    def _determine_position_type(board: chess.Board, classification: Dict) -> str:
        """Determine the primary position type"""
        pawn = classification["pawn_structure"]
        piece = classification["piece_activity"]
        king = classification["king_safety"]
        space = classification["space_control"]
        
        # Fianchetto positions
        if pawn["white_fianchetto"] or pawn["black_fianchetto"]:
            return "Fianchetto"
        
        # Central control positions
        if piece["white_centralization"] > 5.5 or piece["black_centralization"] > 5.5:
            return "CentralControl"
        
        # Kingside attack
        if piece["white_centralization"] > piece["black_centralization"] + 1:
            return "KingsideAttack"
        elif piece["black_centralization"] > piece["white_centralization"] + 1:
            return "QueensideAttack"
        
        # Closed positional positions
        if pawn["pawn_symmetry"] == "symmetric":
            return "ClosedPositional"
        
        # Sharp tactical positions
        if (king["white_king_safety"] < 0.5 or king["black_king_safety"] < 0.5):
            return "SharpTactical"
        
        # Long middlegame
        if piece["white_piece_count"] > 4 and piece["black_piece_count"] > 4:
            return "LongMiddlegame"
        
        # Endgame-approaching
        if piece["white_piece_count"] <= 2 or piece["black_piece_count"] <= 2:
            return "EndgameApproaching"
        
        return "Mixed"
    
    @staticmethod
    def classify_games_by_position_type(
        games_data: List[Dict], 
        username: str
    ) -> Dict[str, List[Dict]]:
        """
        Classify all positions from games by type
        Returns dict mapping position_type -> list of positions with outcomes
        """
        position_types_map = {}
        
        for game_data in games_data:
            positions = game_data.get("positions", [])
            result = game_data.get("result", "*")
            
            # Determine outcome from player perspective
            white = game_data.get("white", "").lower().strip()
            is_white = white == username.lower().strip()
            
            if result == "1-0":
                outcome = "win" if is_white else "loss"
            elif result == "0-1":
                outcome = "loss" if is_white else "win"
            else:
                outcome = "draw"
            
            for fen in positions:
                classification = PositionClassifier.classify_position(fen)
                pos_type = classification.get("position_type", "Unknown")
                
                if pos_type not in position_types_map:
                    position_types_map[pos_type] = []
                
                position_types_map[pos_type].append({
                    "fen": fen,
                    "outcome": outcome,
                    "classification": classification
                })
        
        return position_types_map
    
    @staticmethod
    def find_best_position_pairs(
        position_types_map: Dict[str, List[Dict]],
        num_pairs: int = 5
    ) -> List[Tuple[str, str]]:
        """
        Find contrasting position type pairs for the questionnaire
        Returns list of (position_type_1, position_type_2) tuples
        """
        position_types = list(position_types_map.keys())
        
        if len(position_types) < 2:
            return []
        
        # Calculate win rate for each position type
        win_rates = {}
        for pos_type, positions in position_types_map.items():
            wins = sum(1 for p in positions if p["outcome"] == "win")
            total = len(positions)
            win_rates[pos_type] = wins / total if total > 0 else 0
        
        # Sort by win rate
        sorted_types = sorted(position_types, key=lambda x: win_rates[x], reverse=True)
        
        # Create contrasting pairs — each type appears at most ONCE, no repeats
        used: set = set()
        pairs = []
        lo, hi = 0, len(sorted_types) - 1
        while lo < hi and len(pairs) < num_pairs:
            t1, t2 = sorted_types[lo], sorted_types[hi]
            if t1 not in used and t2 not in used:
                pairs.append((t1, t2))
                used.add(t1)
                used.add(t2)
            lo += 1
            hi -= 1

        return pairs[:num_pairs]
