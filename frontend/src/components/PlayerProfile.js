import React from 'react';
import './PlayerProfile.css';

function PlayerProfile({ profile, onContinue, onReset }) {
  const stats = [
    { label: 'Total Games', value: profile.total_games || 0 },
    { label: 'Win Rate', value: `${((profile.win_rate || 0) * 100).toFixed(1)}%` },
    { label: 'Avg ELO (White)', value: Math.round(profile.avg_elo_white || 0) },
    { label: 'Avg ELO (Black)', value: Math.round(profile.avg_elo_black || 0) },
  ];

  return (
    <div className="player-profile">
      <div className="card">
        <h2>Player Profile Analysis</h2>
        <p>Here's what we learned about your chess style:</p>

        <div className="stats-grid">
          {stats.map((stat, idx) => (
            <div key={idx} className="stat-card">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="openings-section">
          <h3>Your Favorite Openings:</h3>
          <ul className="openings-list">
            {Object.entries(profile.preferred_openings || {}).slice(0, 5).map(([opening, count]) => (
              <li key={opening}>
                <span className="opening-name">{opening}</span>
                <span className="opening-count">{count} games</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="first-moves-section">
          <h3>Your Favorite First Moves:</h3>
          <div className="moves-list">
            {Object.entries(profile.first_moves || {}).slice(0, 5).map(([move, count]) => (
              <span key={move} className="move-badge">{move} ({count})</span>
            ))}
          </div>
        </div>

        <div className="actions">
          <button onClick={onContinue} className="btn-primary">
            Continue to Opening Selection
          </button>
          <button onClick={onReset} className="btn-secondary">
            Import Different Account
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlayerProfile;
