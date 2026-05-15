import React, { useState } from 'react';
import './Dashboard.css';

const MODES = [
  {
    id: 'coach',
    num: '01',
    title: 'AI Coach',
    sub: 'PERSONALIZED TRAINING',
    desc: 'Opening lines built from your own game history — steered toward structures you already win.',
    accent: '#E85D04',
    textColor: '#fff',
    available: true,
    cta: 'Start Training →',
  },
  {
    id: 'explorer',
    num: '02',
    title: 'Opening Explorer',
    sub: 'GLOBAL DATABASE',
    desc: 'Explore any position with global statistics, engine evaluations, and win rates from ChessDB.',
    accent: '#1B6B3A',
    textColor: '#fff',
    available: true,
    cta: 'Explore →',
  },
  {
    id: 'stockfish',
    num: '03',
    title: 'Engine Analysis',
    sub: 'STOCKFISH 18',
    desc: 'Deep analysis mode — play through any line with live engine evaluation and best-move hints.',
    accent: '#1D4ED8',
    textColor: '#fff',
    available: true,
    cta: 'Analyse →',
  },
  {
    id: 'custom',
    num: '04',
    title: 'Game Analysis',
    sub: 'ANALYSE ANY GAME',
    desc: 'Import a PGN, navigate every move, build variation trees, and get Stockfish analysis at any point.',
    accent: '#6B21A8',
    textColor: '#fff',
    available: false,
  },
  {
    id: 'opponent',
    num: '05',
    title: 'vs Opponent',
    sub: 'OPPONENT ANALYSIS',
    desc: "Enter any player's username to see how their opening patterns match up against yours.",
    accent: '#111111',
    textColor: '#fff',
    available: false,
  },
  {
    id: 'play',
    num: '06',
    title: 'Play vs Engine',
    sub: 'STOCKFISH GAME',
    desc: 'Play a full chess game against Stockfish at adjustable strength.',
    accent: '#B45309',
    textColor: '#fff',
    available: false,
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({ username, profile, onSelect, onReset }) {
  const [hovered, setHovered] = useState(null);

  const totalGames = profile?.total_games || 0;
  const winPct = profile
    ? Math.round((profile.wins / (profile.total_games || 1)) * 100)
    : 0;

  return (
    <div className="dashboard">

      {/* ── Greeting ── */}
      <div className="dash-greeting-row">
        <div>
          <p className="dash-good">{getGreeting()},</p>
          <h1 className="dash-name">{username}.</h1>
        </div>
        <button className="dash-reset-btn" onClick={onReset}>
          Switch Account
        </button>
      </div>

      {/* ── Quick stats ── */}
      <div className="dash-stats">
        {[
          { label: 'Games Analyzed', value: totalGames.toLocaleString() },
          { label: 'Overall Win Rate', value: `${winPct}%` },
          { label: 'Fav Opening', value: profile?.top_openings?.[0]?.name?.split(' ').slice(0,2).join(' ') || '—' },
          { label: 'Engine', value: 'Stockfish 18' },
        ].map(s => (
          <div key={s.label} className="dash-stat">
            <span className="dash-stat-val">{s.value}</span>
            <span className="dash-stat-lbl">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Mode heading ── */}
      <div className="dash-modes-heading">
        <span>CHOOSE YOUR TRAINING MODE</span>
      </div>

      {/* ── Mode cards ── */}
      <div className="dash-modes">
        {MODES.map(m => (
          <div
            key={m.id}
            className={`mode-card ${!m.available ? 'mode-soon' : ''} ${hovered === m.id ? 'mode-hovered' : ''}`}
            style={m.available && hovered === m.id ? { background: m.accent, borderColor: m.accent } : {}}
            onClick={() => m.available && onSelect(m.id)}
            onMouseEnter={() => setHovered(m.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="mode-num" style={m.available && hovered === m.id ? { color: 'rgba(255,255,255,0.6)' } : {}}>
              {m.num}
            </div>

            {!m.available && <div className="soon-badge">COMING SOON</div>}

            <div className="mode-sub" style={m.available && hovered === m.id ? { color: 'rgba(255,255,255,0.7)' } : {}}>
              {m.sub}
            </div>

            <h2 className="mode-title" style={m.available && hovered === m.id ? { color: '#fff' } : {}}>
              {m.title}
            </h2>

            <p className="mode-desc" style={m.available && hovered === m.id ? { color: 'rgba(255,255,255,0.8)' } : {}}>
              {m.desc}
            </p>

            {m.available && (
              <div className="mode-cta" style={hovered === m.id ? { color: '#fff', borderColor: 'rgba(255,255,255,0.4)' } : {}}>
                {m.cta}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
