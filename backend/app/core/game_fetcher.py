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
        # OpeningTree-like headers
        self.session.headers.update({
            'User-Agent': 'ChessSecond/1.0'
        })
    
    def get_games(self, username: str, game_type: str = "pgn", max_archives: int = 3) -> Optional[str]:
        """
        Fetch games for a user. game_type can be 'pgn' or 'json'
        Returns PGN format or None if failed
        Fetches multiple months of games like OpeningTree does
        """
        try:
            # IMPORTANT: Chess.com API is case-sensitive! Do NOT convert to lowercase
            username = username.strip()
            
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
            
            print(f"Found {len(archives)} archives. Fetching {max_archives} most recent...")
            
            # Fetch multiple archives (like OpeningTree does) - most recent first
            all_pgn = ""
            archives_to_fetch = archives[-max_archives:]  # Get last 3 months
            
            for archive_url in reversed(archives_to_fetch):  # Reverse to get chronological order
                try:
                    print(f"Fetching from archive: {archive_url}")
                    if game_type == "pgn":
                        games_response = self.session.get(f"{archive_url}/pgn", timeout=15)
                    else:
                        games_response = self.session.get(archive_url, timeout=15)
                    
                    games_response.raise_for_status()
                    all_pgn += games_response.text + "\n"
                    print(f"Successfully fetched {len(games_response.text)} chars from {archive_url}")
                except Exception as e:
                    print(f"Error fetching archive {archive_url}: {e}")
                    continue
            
            if not all_pgn.strip():
                print(f"No PGN data fetched from any archive for {username}")
                return None
                
            return all_pgn
        except Exception as e:
            print(f"Error fetching from Chess.com: {e}")
            import traceback
            traceback.print_exc()
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
