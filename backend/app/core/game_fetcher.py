"""
Fetch games from Chess.com and Lichess APIs
"""
import requests
from typing import List, Dict, Optional
import json

class ChessDotComFetcher:
    """Fetch games from Chess.com"""
    BASE_URL = "https://api.chess.com/pub"
    
    def __init__(self):
        self.session = requests.Session()
    
    def get_games(self, username: str, game_type: str = "pgn") -> Optional[str]:
        """
        Fetch games for a user. game_type can be 'pgn' or 'json'
        Returns PGN format or None if failed
        """
        try:
            # Get player stats first to fetch archive URLs
            stats_url = f"{self.BASE_URL}/player/{username}/games/archives"
            print(f"Fetching archives from: {stats_url}")
            response = self.session.get(stats_url, timeout=10)
            
            if response.status_code == 403:
                print(f"403 Forbidden: Player '{username}' may have a private profile or games")
                return None
            elif response.status_code == 404:
                print(f"404 Not Found: Player '{username}' does not exist")
                return None
            
            response.raise_for_status()
            archives = response.json().get("archives", [])
            
            if not archives:
                print(f"No game archives found for {username}")
                return None
            
            # Fetch the most recent month's games
            latest_archive = archives[-1]
            print(f"Fetching from archive: {latest_archive}")
            games_response = self.session.get(f"{latest_archive}/pgn" if game_type == "pgn" else latest_archive, timeout=10)
            games_response.raise_for_status()
            
            return games_response.text
        except Exception as e:
            print(f"Error fetching from Chess.com: {e}")
            return None


class LichessFetcher:
    """Fetch games from Lichess"""
    BASE_URL = "https://lichess.org/api"
    
    def __init__(self):
        self.session = requests.Session()
    
    def get_games(self, username: str, max_games: int = 100) -> Optional[str]:
        """
        Fetch games for a user from Lichess.
        Returns PGN format or None if failed
        """
        try:
            url = f"{self.BASE_URL}/user/{username}/games/export"
            params = {"max": max_games, "pgnInJson": False}
            headers = {"Accept": "application/x-chess-pgn"}
            
            print(f"Fetching from Lichess: {url}")
            response = self.session.get(url, params=params, headers=headers, timeout=15)
            
            if response.status_code == 404:
                print(f"404 Not Found: Lichess user '{username}' does not exist")
                return None
            
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"Error fetching from Lichess: {e}")
            return None
