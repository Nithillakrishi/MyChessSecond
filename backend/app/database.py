"""
User database module for storing player profiles and preferences
"""
import sqlite3
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'chess_users.db')

def init_db():
    """Initialize the database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP
        )
    ''')
    
    # User data cache table (stores fetched games, profile, etc.)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            data_type TEXT NOT NULL,  -- 'games', 'profile', 'questionnaire', 'preferences'
            data TEXT NOT NULL,  -- JSON
            source TEXT,  -- 'chess.com', 'lichess'
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Preferences table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            positions_preferences TEXT,  -- JSON dict of position_type -> score
            color TEXT,  -- 'white' or 'black'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    # Coach sessions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS coach_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            opening_name TEXT NOT NULL,
            opening_eco TEXT,
            opening_moves TEXT,
            chat_history TEXT DEFAULT '[]',
            board_move_index INTEGER DEFAULT 0,
            notes TEXT DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    conn.commit()
    conn.close()

def register_user(username: str) -> Dict[str, Any]:
    """Register a new user or return existing user"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('INSERT INTO users (username) VALUES (?)', (username,))
        conn.commit()
        user_id = cursor.lastrowid
        return {"success": True, "user_id": user_id, "token": f"token_{user_id}"}
    except sqlite3.IntegrityError:
        # User already exists
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        result = cursor.fetchone()
        if result:
            user_id = result[0]
            # Update last_login
            cursor.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user_id,))
            conn.commit()
            return {"success": True, "user_id": user_id, "token": f"token_{user_id}"}
        return {"success": False, "message": "Error retrieving user"}
    finally:
        conn.close()

def get_user_id(username: str) -> Optional[int]:
    """Get user ID by username"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else None

def save_user_data(user_id: int, data_type: str, data: Dict, source: str = None):
    """Save user data (games, profile, etc.)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Delete old data of same type
    cursor.execute('DELETE FROM user_data WHERE user_id = ? AND data_type = ?', (user_id, data_type))
    
    # Insert new data
    cursor.execute('''
        INSERT INTO user_data (user_id, data_type, data, source)
        VALUES (?, ?, ?, ?)
    ''', (user_id, data_type, json.dumps(data), source))
    
    conn.commit()
    conn.close()

def get_user_data(user_id: int, data_type: str) -> Optional[Dict]:
    """Get cached user data"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT data FROM user_data 
        WHERE user_id = ? AND data_type = ?
        ORDER BY last_updated DESC
        LIMIT 1
    ''', (user_id, data_type))
    result = cursor.fetchone()
    conn.close()
    return json.loads(result[0]) if result else None

def save_preferences(user_id: int, position_preferences: Dict[str, int], color: str):
    """Save user preferences"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO preferences (user_id, positions_preferences, color, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ''', (user_id, json.dumps(position_preferences), color))
    
    conn.commit()
    conn.close()

def get_preferences(user_id: int) -> Optional[Dict]:
    """Get user preferences"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT positions_preferences, color FROM preferences
        WHERE user_id = ?
    ''', (user_id,))
    result = cursor.fetchone()
    conn.close()
    
    if result:
        return {
            "positions_preferences": json.loads(result[0]),
            "color": result[1]
        }
    return None

def save_coach_session(username: str, opening_name: str, opening_eco: str,
                        opening_moves: str, chat_history: list,
                        board_move_index: int, notes: dict,
                        session_id: Optional[int] = None) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if session_id:
        cursor.execute('''
            UPDATE coach_sessions SET chat_history=?, board_move_index=?, notes=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=? AND username=?
        ''', (json.dumps(chat_history), board_move_index, json.dumps(notes), session_id, username))
        conn.commit()
        conn.close()
        return session_id
    else:
        cursor.execute('''
            INSERT INTO coach_sessions (username, opening_name, opening_eco, opening_moves, chat_history, board_move_index, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (username, opening_name, opening_eco, opening_moves, json.dumps(chat_history), board_move_index, json.dumps(notes)))
        sid = cursor.lastrowid
        conn.commit()
        conn.close()
        return sid

def list_coach_sessions(username: str) -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, opening_name, opening_eco, created_at, updated_at
        FROM coach_sessions WHERE username=? ORDER BY updated_at DESC
    ''', (username,))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "opening_name": r[1], "opening_eco": r[2],
             "created_at": r[3], "updated_at": r[4]} for r in rows]

def get_coach_session(session_id: int, username: str) -> Optional[Dict]:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, username, opening_name, opening_eco, opening_moves,
               chat_history, board_move_index, notes, created_at, updated_at
        FROM coach_sessions WHERE id=? AND username=?
    ''', (session_id, username))
    r = cursor.fetchone()
    conn.close()
    if not r:
        return None
    return {
        "id": r[0], "username": r[1], "opening_name": r[2], "opening_eco": r[3],
        "opening_moves": r[4], "chat_history": json.loads(r[5]),
        "board_move_index": r[6], "notes": json.loads(r[7]),
        "created_at": r[8], "updated_at": r[9]
    }

def delete_coach_session(session_id: int, username: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM coach_sessions WHERE id=? AND username=?', (session_id, username))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# Initialize DB on import
if not os.path.exists(DB_PATH):
    init_db()
else:
    init_db()  # run always so new tables are created in existing DBs
