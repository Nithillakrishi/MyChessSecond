import requests
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
}
session = requests.Session()
session.headers.update(headers)

# Test different usernames
for username in ['NithilPY', 'nithlipy', 'NithilPy']:
    try:
        r = session.get(f'https://api.chess.com/pub/player/{username}/games/archives', timeout=5)
        print(f'{username}: Status={r.status_code}, Archives={len(r.json().get("archives", []))}')
    except Exception as e:
        print(f'{username}: Error={e}')
