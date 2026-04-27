"""
Parse PGN files and extract opening lines and positions
"""
import chess.pgn
from io import StringIO
from typing import List, Dict, Tuple, Optional
import re

class PGNParser:
    """Parse PGN format games and extract opening information"""
    
    @staticmethod
    def parse_pgn(pgn_text: str) -> List[chess.pgn.Game]:
        """Parse PGN text and return list of games"""
        games = []
        pgn_io = StringIO(pgn_text)
        game_count = 0
        error_count = 0
        
        while True:
            try:
                game = chess.pgn.read_game(pgn_io)
                if game is None:
                    break
                games.append(game)
                game_count += 1
            except Exception as e:
                error_count += 1
                print(f"Error parsing game {game_count + error_count}: {e}")
                # Skip malformed games and continue
                continue
        
        print(f"Successfully parsed {game_count} games with {error_count} errors")
        return games
    
    @staticmethod
    def extract_opening_moves(game: chess.pgn.Game, depth: int = 6) -> Dict:
        """
        Extract opening moves up to specified depth
        Returns dict with moves, FEN positions, and opening info
        """
        moves = []
        positions = []
        board = chess.Board()
        
        node = game
        move_count = 0
        
        try:
            while node.variations and move_count < depth:
                move = node.variations[0].move
                
                # Validate move is legal before pushing
                if move not in board.legal_moves:
                    print(f"Warning: Invalid move {move.uci()} in game, stopping parsing")
                    break
                
                moves.append(move.uci())
                board.push(move)
                positions.append(board.fen())
                move_count += 1
                node = node.variations[0]
        except Exception as e:
            print(f"Error parsing opening moves: {e}")
            # Continue with partial data
        
        # Extract opening from game headers
        opening = game.headers.get("Opening", "Unknown")
        eco = game.headers.get("ECO", "")
        
        return {
            "moves": moves,
            "positions": positions,
            "opening": opening,
            "eco": eco,
            "white": game.headers.get("White", ""),
            "black": game.headers.get("Black", ""),
            "result": game.headers.get("Result", ""),
            "elo_white": game.headers.get("WhiteElo", ""),
            "elo_black": game.headers.get("BlackElo", "")
        }
    
    @staticmethod
    def get_first_move(game: chess.pgn.Game) -> Optional[str]:
        """Get the first move of a game"""
        if game.variations:
            return game.variations[0].move.uci()
        return None
    
    @staticmethod
    def group_by_opening(games: List[chess.pgn.Game], depth: int = 6) -> Dict[str, List]:
        """
        Group games by their opening lines
        Returns dict where key is opening sequence and value is list of games
        """
        opening_groups = {}
        
        for game in games:
            opening_data = PGNParser.extract_opening_moves(game, depth)
            opening_key = " ".join(opening_data["moves"])
            
            if opening_key not in opening_groups:
                opening_groups[opening_key] = []
            
            opening_groups[opening_key].append({
                "game": game,
                "opening_data": opening_data
            })
        
        return opening_groups
    
    @staticmethod
    def filter_by_color(games: List[chess.pgn.Game], color: str) -> List[chess.pgn.Game]:
        """Filter games where player played as specific color (white/black)"""
        filtered = []
        for game in games:
            if color.lower() == "white":
                filtered.append(game)
            elif color.lower() == "black":
                filtered.append(game)
        return filtered
