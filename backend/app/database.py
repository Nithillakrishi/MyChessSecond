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

# Initialize DB on import
if not os.path.exists(DB_PATH):
    init_db()
