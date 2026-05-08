from backend.app.core.game_fetcher import ChessDotComFetcher
from backend.app.core.pgn_parser import PGNParser
from backend.app.core.player_profiler import PlayerProfiler

fetcher = ChessDotComFetcher()
pgn_data = fetcher.get_games('NithilPY', max_archives=1)

games = PGNParser.parse_pgn(pgn_data)
print(f'Total games fetched: {len(games)}')

# Test the profiler
profile = PlayerProfiler.analyze_player_style(games, username='NithilPY')
print(f'\nProfile results:')
print(f'Total games: {profile["total_games"]}')
print(f'Games as white: {profile["total_games_as_white"]}')
print(f'Games as black: {profile["total_games_as_black"]}')
print(f'Win rate: {profile["win_rate"]:.2%}')
print(f'First moves: {profile["first_moves"]}')
print(f'Preferred openings: {profile["preferred_openings"]}')
