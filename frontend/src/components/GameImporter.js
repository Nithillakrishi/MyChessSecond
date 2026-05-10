import React, { useState } from 'react';
import './GameImporter.css';

function GameImporter({ onImport, disabled }) {
  const [source, setSource] = useState('chess.com');
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onImport(source, username.trim());
    }
  };

  return (
    <div className="game-importer">
      <div className="card">
        <h2>Import Your Games</h2>
        <p>Connect your Chess.com or Lichess account to get personalized coaching.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="source">Chess Platform</label>
            <select
              id="source"
              value={source}
              onChange={e => setSource(e.target.value)}
              disabled={disabled}
            >
              <option value="chess.com">Chess.com</option>
              <option value="lichess">Lichess</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={disabled}
              autoComplete="off"
            />
          </div>

          <button type="submit" disabled={disabled || !username.trim()}>
            {disabled ? 'Loading…' : 'Import Games →'}
          </button>
        </form>

        <div className="info">
          <p>We'll fetch your recent games and analyze your opening preferences — no password needed.</p>
        </div>
      </div>
    </div>
  );
}

export default GameImporter;
