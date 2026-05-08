# Quick Start: Personal Repertoire Generation

This guide shows how to generate a personalized opening repertoire that combines your playing style with new openings.

## The Workflow

```
1. Analyze Profile     → Get your game statistics
2. Generate Questions → 5 position preference questions
3. Submit Preferences → Your position preferences + desired opening moves
4. Get Repertoire    → Custom opening lines matching your style
```

---

## Complete Example (Python)

```python
import requests
import json

BASE_URL = "http://localhost:8000"
USERNAME = "NithilPY"

# ============================================================
# STEP 1: Analyze Your Games
# ============================================================
print("📊 Analyzing your games...")
response = requests.post(f"{BASE_URL}/analyze-profile", json={
    "source": "chess.com",
    "username": USERNAME
})
profile = response.json()

print(f"✓ Found {profile['total_games']} games")
print(f"  Win rate: {profile['win_rate']*100:.1f}%")
print(f"  Games as White: {profile['total_games_as_white']}")
print(f"  Games as Black: {profile['total_games_as_black']}")

# ============================================================
# STEP 2: Generate Position Preference Questions
# ============================================================
print("\n❓ Generating questionnaire...")
response = requests.post(f"{BASE_URL}/generate-questionnaire", json={
    "source": "chess.com",
    "username": USERNAME
})
questionnaire = response.json()

print(f"✓ Generated {len(questionnaire['questions'])} questions")
for q in questionnaire['questions']:
    print(f"\nQuestion {q['question_id']}:")
    print(f"  A) {q['description_1']} (Your win rate: {q['your_win_rate_1']})")
    print(f"  B) {q['description_2']} (Your win rate: {q['your_win_rate_2']})")

# ============================================================
# STEP 3: Submit Your Preferences
# ============================================================
print("\n📝 Submitting preferences...")

# Rate each position type on a scale 1-5
# Higher = more preference
preferences = {
    "username": USERNAME,
    "preferences": {
        "Fianchetto": 5,               # ⭐⭐⭐⭐⭐ Love Fianchetto!
        "CentralControl": 4,           # ⭐⭐⭐⭐ Also like central control
        "KingsideAttack": 4,           # ⭐⭐⭐⭐ Kingside attacks
        "SharpTactical": 2,            # ⭐⭐ Don't like sharp tactics
        "ClosedPositional": 3,         # ⭐⭐⭐ Neutral on closed positions
    },
    "desired_first_moves": ["c2c4", "d2d4"],  # Want to try 1.c4 & 1.d4
    "color": "white"
}

response = requests.post(f"{BASE_URL}/submit-preferences", json=preferences)
result = response.json()
print(f"✓ Preferences saved!")

# ============================================================
# STEP 4: Get Your Personalized Opening Repertoire
# ============================================================
print("\n🎯 Generating personalized repertoire...")
response = requests.get(f"{BASE_URL}/get-personalized-repertoire")
repertoire = response.json()

print(f"✓ Generated {len(repertoire['recommended_lines'])} opening lines!")
print(f"\n{repertoire['message']}")

print(f"\nYour preferred position types: {', '.join(repertoire['preferred_position_types'])}")

print(f"\nRecommended Lines:")
for i, line in enumerate(repertoire['recommended_lines'], 1):
    print(f"\n#{i} - {line['opening']}")
    print(f"   Moves: {' '.join(line['moves'][:5])}")
    print(f"   Positions: {' → '.join(line['position_types_reached'][:3])}")
    if 'outcome' in line:
        print(f"   Your result: {line['outcome'].upper()}")

print("\n✅ Ready to study your personalized repertoire!")
```

---

## Example Output

### Step 1: Profile Analysis

```
📊 Analyzing your games...
✓ Found 740 games
  Win rate: 50.9%
  Games as White: 363
  Games as Black: 377
```

### Step 2: Questions Generated

```
❓ Generating questionnaire...
✓ Generated 5 questions

Question 1:
  A) Fianchettoed bishop on long diagonal... (Your win rate: 52.3%)
  B) Centralized pieces with strong center control (Your win rate: 48.1%)

Question 2:
  A) Symmetric pawn structure, positional maneuvering (Your win rate: 51.2%)
  B) Tactical positions with exposed kings (Your win rate: 45.8%)

[3 more questions...]
```

### Step 3: Preferences Saved

```
📝 Submitting preferences...
✓ Preferences saved!
```

### Step 4: Personalized Repertoire

```
🎯 Generating personalized repertoire...
✓ Generated 5 opening lines!

Generated 5 personalized opening lines combining your preferred positions
with ['c2c4', 'd2d4']

Your preferred position types: Fianchetto, CentralControl, KingsideAttack

Recommended Lines:

#1 - English Opening / Fianchetto
   Moves: c4 g6 g3 Bg7
   Positions: Fianchetto → CentralControl → LongMiddlegame
   Your result: WIN

#2 - Queen's Indian / Fianchetto
   Moves: d4 Nf6 c4 g6
   Positions: Fianchetto → CentralControl → KingsideAttack
   Your result: WIN

#3 - Reti Opening
   Moves: Nf3 d5 c4 c6
   Positions: CentralControl → Fianchetto → LongMiddlegame
   Your result: DRAW
```

---

## What This Means

### Your Decision

**"I want to surprise with 1.c4, but I'm only confident in Fianchetto positions"**

### What Chess Second Does

1. **Finds** all your games with Fianchetto structures → 52.3% win rate
2. **Identifies** 1.c4 lines that lead to Fianchetto positions
3. **Shows** 5 of your best games reaching these structures
4. **Recommends** English/Reti Fianchetto as "surprise 1.c4 lines"

### The Result

✅ **Surprise** opponent with 1.c4 (not your usual 1.d4)
✅ **Comfortable** because you reach Fianchetto (your strength!)
✅ **Confident** with examples from your own wins

---

## Benefits of This Approach

1. **Personalized** - Based on YOUR games, not generic theory
2. **Data-driven** - Win rates show what works for you
3. **Hybrid** - Combines new openings with familiar positions
4. **Confidence** - Study positions from your own victories
5. **Surprise** - Opponents see openings they didn't expect
6. **Understanding** - Play positions that suit your style

---

## Next: Frontend Integration

The frontend should:

1. Show questionnaire with position pair images/descriptions
2. Let user rank each pair (1-5 scale)
3. Input desired opening moves
4. Display recommended lines with your games
5. Browse candidate positions

See `IMPLEMENTATION.md` for full technical details.
