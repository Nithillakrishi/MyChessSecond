import requests
import json

BASE_URL = "http://localhost:8000"
USERNAME = "NithilPY"

print("=" * 60)
print("STEP 1: Analyze Profile")
print("=" * 60)

response = requests.post(f"{BASE_URL}/analyze-profile", json={
    "source": "chess.com",
    "username": USERNAME
})
profile = response.json()
print(f"✓ Analyzed {profile['total_games']} games")
print(f"  - Win Rate: {profile['win_rate']*100:.1f}%")
print(f"  - Games as White: {profile['total_games_as_white']}")
print(f"  - Games as Black: {profile['total_games_as_black']}")

print("\n" + "=" * 60)
print("STEP 2: Generate Questionnaire")
print("=" * 60)

response = requests.post(f"{BASE_URL}/generate-questionnaire", json={
    "source": "chess.com",
    "username": USERNAME
})
questionnaire = response.json()
print(f"✓ Generated questionnaire with {len(questionnaire['questions'])} questions")
print(f"  - Position types found: {questionnaire['position_types_found']}")

for q in questionnaire['questions']:
    print(f"\nQuestion {q['question_id']}: {q['position_type_1']} vs {q['position_type_2']}")
    print(f"  Option 1: {q['description_1']} (Your win rate: {q['your_win_rate_1']})")
    print(f"  Option 2: {q['description_2']} (Your win rate: {q['your_win_rate_2']})")

print("\n" + "=" * 60)
print("STEP 3: Submit Preferences")
print("=" * 60)

preferences = {
    "username": USERNAME,
    "preferences": {
        "Fianchetto": 5,
        "CentralControl": 4,
        "KingsideAttack": 4,
        "SharpTactical": 2,
        "ClosedPositional": 3
    },
    "desired_first_moves": ["c2c4", "d2d4"],
    "color": "white"
}

response = requests.post(f"{BASE_URL}/submit-preferences", json=preferences)
result = response.json()
print(f"✓ Preferences saved:")
print(f"  - Preferred position types: Fianchetto (5), Central Control (4), Kingside Attack (4)")
print(f"  - Desired first moves: 1.c4, 1.d4")
print(f"  - Color: White")

print("\n" + "=" * 60)
print("STEP 4: Generate Personalized Repertoire")
print("=" * 60)

response = requests.get(f"{BASE_URL}/get-personalized-repertoire")
repertoire = response.json()
print(f"✓ Generated personalized repertoire!")
print(f"  - Preferred position types: {', '.join(repertoire['preferred_position_types'])}")
print(f"  - Total recommendations: {len(repertoire['recommended_lines'])}")
print(f"\n{repertoire['message']}")

print(f"\nRecommended lines ({len(repertoire['recommended_lines'])} found):")
for i, line in enumerate(repertoire['recommended_lines'][:3], 1):
    print(f"\n  Line {i}:")
    print(f"    Moves: {' '.join(line['moves'])}")
    print(f"    Opening: {line['opening']}")
    print(f"    Position types reached: {', '.join(line['position_types_reached'])}")
    if 'outcome' in line:
        print(f"    Outcome in your games: {line['outcome'].upper()}")

print("\n" + "=" * 60)
print("✅ COMPLETE WORKFLOW SUCCESSFUL!")
print("=" * 60)
