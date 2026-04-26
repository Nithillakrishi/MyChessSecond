import React, { useState } from 'react';
import './GameImporter.css';

function GameImporter({ onImport, onDemo, disabled }) {
  const [source, setSource] = useState('chess.com');
  const [username, setUsername] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      setSubmitted(true);
      onImport(source, username);
    }
  };

  const handleDemo = () => {
    onDemo();
  };

  return (
    <div className="game-importer">
      <div className="card">
        <h2>Import Your Games</h2>
        <p>Connect your Chess.com or Lichess account to get started</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="source">Chess Platform:</label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={disabled}
            >
              <option value="chess.com">Chess.com</option>
              <option value="lichess">Lichess</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={disabled}
            />
          </div>

          <button type="submit" disabled={disabled || !username.trim()}>
            {disabled ? 'Loading...' : 'Import Games'}
          </button>
        </form>

        <div style={{ margin: '20px 0', textAlign: 'center', color: '#666' }}>
          <p>or</p>
        </div>

        <button 
          type="button" 
          onClick={handleDemo}
          disabled={disabled}
          className="demo-button"
          style={{ backgroundColor: '#4CAF50', width: '100%', marginBottom: '10px' }}
        >
          🎮 Try Demo Mode
        </button>

        <p style={{ marginBottom: '0', fontSize: '0.9em', color: '#888', textAlign: 'center' }}>
          Load sample games to explore the app
        </p>

        <div className="info">
          <p>💡 Tip: This will fetch your recent games and analyze your opening preferences</p>
        </div>
      </div>
    </div>
  );
}

export default GameImporter;
