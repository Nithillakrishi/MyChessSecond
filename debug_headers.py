from backend.app.core.game_fetcher import ChessDotComFetcher
from backend.app.core.pgn_parser import PGNParser
import chess.pgn

fetcher = ChessDotComFetcher()
pgn_data = fetcher.get_games('NithilPY', max_archives=1)

games = PGNParser.parse_pgn(pgn_data)
print(f'Total games: {len(games)}')
if games:
    for i in range(min(5, len(games))):
        print(f'\n--- Game {i+1} ---')
        print(f'White: |{games[i].headers.get("White")}|')
        print(f'Black: |{games[i].headers.get("Black")}|')
        print(f'Opening: |{games[i].headers.get("Opening")}|')
        print(f'Result: {games[i].headers.get("Result")}')
        print(f'WhiteElo: {games[i].headers.get("WhiteElo")}')
        print(f'BlackElo: {games[i].headers.get("BlackElo")}')
