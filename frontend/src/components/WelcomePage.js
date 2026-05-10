import React from 'react';
import './WelcomePage.css';

const MODE_CARDS = [
  {
    id: 'coach',
    icon: '♟',
    color: 'var(--green)',
    gradient: 'linear-gradient(135deg,rgba(127,166,80,0.18) 0%,rgba(92,122,56,0.08) 100%)',
    border: 'rgba(127,166,80,0.4)',
    title: 'AI Opening Coach',
    desc: 'Lines built from your own game history. The coach steers you toward positions where you score best.',
    cta: 'Start coaching →',
  },
  {
    id: 'explorer',
    icon: '🌐',
    color: 'var(--gold)',
    gradient: 'linear-gradient(135deg,rgba(229,139,0,0.18) 0%,rgba(184,110,0,0.08) 100%)',
    border: 'rgba(229,139,0,0.4)',
    title: 'Chess Explorer',
    desc: 'Global stats from ChessDB — engine evaluations and win rates for every legal move from any position.',
    cta: 'Explore openings →',
  },
  {
    id: 'stockfish',
    icon: '⚡',
    color: '#5B9BD5',
    gradient: 'linear-gradient(135deg,rgba(91,155,213,0.18) 0%,rgba(60,110,170,0.08) 100%)',
    border: 'rgba(91,155,213,0.4)',
    title: 'Engine Training',
    desc: 'Live Stockfish 18 in the browser. Eval bar, best move, and search depth on every position you reach.',
    cta: 'Train with engine →',
  },
  {
    id: 'opponent',
    icon: '👥',
    color: '#C4874A',
    gradient: 'linear-gradient(135deg,rgba(196,135,74,0.18) 0%,rgba(160,100,50,0.08) 100%)',
    border: 'rgba(196,135,74,0.4)',
    title: 'vs Player Database',
    desc: "Enter any username. See their opening tendencies and practice against their favourite moves.",
    cta: 'Enter username →',
  },
  {
    id: 'position',
    icon: '🎯',
    color: '#9B59B6',
    gradient: 'linear-gradient(135deg,rgba(155,89,182,0.18) 0%,rgba(120,60,150,0.08) 100%)',
    border: 'rgba(155,89,182,0.4)',
    title: 'Custom Position',
    desc: 'Load any FEN and analyse or train from that exact setup with full Stockfish + ChessDB support.',
    cta: 'Load position →',
  },
  {
    id: 'playvs',
    icon: '♜',
    color: 'var(--red)',
    gradient: 'linear-gradient(135deg,rgba(192,57,43,0.18) 0%,rgba(150,40,30,0.08) 100%)',
    border: 'rgba(192,57,43,0.4)',
    title: 'Play vs Stockfish',
    desc: 'Full game against the engine at 5 difficulty levels — from beginner friendly to master strength.',
    cta: 'Start game →',
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WelcomePage({ username, profile, onSelect, questionnaireData }) {
  const stats = profile?.opening_stats || {};
  const totalGames = profile?.total_games ?? 0;
  const winRate = profile?.win_rate ? `${Math.round(profile.win_rate * 100)}%` : '—';
  const topOpening = stats && Object.keys(stats).length > 0
    ? Object.entries(stats).sort((a, b) => b[1].games - a[1].games)[0]?.[0]
    : null;

  return (
    <div className="wp-root">
      {/* Greeting */}
      <div className="wp-greeting">
        <div className="wp-greeting-glow" />
        <p className="wp-hi">{getGreeting()},</p>
        <h1 className="wp-name">{username}</h1>
        <p className="wp-tagline">good to have you here. ready to level up?</p>
      </div>

      {/* Stats row */}
      {totalGames > 0 && (
        <div className="wp-stats">
          <div className="wp-stat">
            <span className="wp-stat-v">{totalGames}</span>
            <span className="wp-stat-l">Games analyzed</span>
          </div>
          <div className="wp-stat">
            <span className="wp-stat-v" style={{ color: 'var(--green)' }}>{winRate}</span>
            <span className="wp-stat-l">Win rate</span>
          </div>
          {topOpening && (
            <div className="wp-stat">
              <span className="wp-stat-v wp-stat-opening">{topOpening}</span>
              <span className="wp-stat-l">Top opening</span>
            </div>
          )}
          {questionnaireData && (
            <div className="wp-stat">
              <span className="wp-stat-v" style={{ color: 'var(--gold)' }}>✓</span>
              <span className="wp-stat-l">Style profiled</span>
            </div>
          )}
        </div>
      )}

      {/* Mode cards */}
      <div className="wp-section-label">Choose your training mode</div>
      <div className="wp-cards">
        {MODE_CARDS.map(card => (
          <button
            key={card.id}
            className="wp-card"
            style={{
              background: card.gradient,
              borderColor: card.border,
            }}
            onClick={() => onSelect(card.id)}
          >
            <div className="wp-card-icon" style={{ color: card.color }}>{card.icon}</div>
            <div className="wp-card-body">
              <h3 style={{ color: card.color }}>{card.title}</h3>
              <p>{card.desc}</p>
            </div>
            <span className="wp-card-cta" style={{ color: card.color }}>{card.cta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
