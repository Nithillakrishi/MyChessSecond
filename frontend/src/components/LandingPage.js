import React from 'react';
import './LandingPage.css';

/* ── Logo: bold "2nd" superscript mark ── */
export function Logo({ size = 40 }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="lgb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B58863"/>
          <stop offset="100%" stopColor="#312E2B"/>
        </linearGradient>
        <linearGradient id="lgg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7FA650"/>
          <stop offset="100%" stopColor="#5C7A38"/>
        </linearGradient>
      </defs>
      {/* Board-square background */}
      <rect width="48" height="48" rx="10" fill="url(#lgb)"/>
      {/* Checkerboard corners */}
      <rect x="0" y="0" width="10" height="10" rx="3" fill="rgba(240,217,181,0.18)"/>
      <rect x="38" y="0" width="10" height="10" rx="0" style={{borderTopRightRadius:10}} fill="rgba(240,217,181,0.18)"/>
      <rect x="0" y="38" width="10" height="10" fill="rgba(240,217,181,0.18)"/>
      <rect x="38" y="38" width="10" height="10" fill="url(#lgg)"/>
      {/* "2" large */}
      <text x="18" y="36" textAnchor="middle" fill="#F0D9B5"
            fontSize="26" fontWeight="900" fontFamily="Georgia,'Times New Roman',serif">2</text>
      {/* "nd" superscript */}
      <text x="33" y="22" textAnchor="middle" fill="#E58B00"
            fontSize="12" fontWeight="800" fontFamily="Inter,sans-serif">nd</text>
    </svg>
  );
}

export default function LandingPage({ onStart }) {
  return (
    <div className="lp">

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <Logo size={34} />
          <span>MyChess<strong>2nd</strong></span>
        </div>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </div>
        <button className="lp-nav-cta" onClick={onStart}>Get Started</button>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero">
        {/* Glows removed */}

        <div className="lp-badge">AI-Powered · Stockfish 18 · Your Real Games</div>

        <h1 className="lp-hero-title">
          Your chess coach.<br/>
          <span className="lp-title-gradient">Built from your games.</span>
        </h1>

        <p className="lp-hero-sub">
          MyChess2nd reads your opening history and steers you toward structures
          where your win rate is highest — not just the most popular moves.
        </p>

        <div className="lp-hero-btns">
          <button className="lp-btn-primary" onClick={onStart}>
            Import Your Games →
          </button>
          <button className="lp-btn-ghost" onClick={() => document.getElementById('features').scrollIntoView({behavior:'smooth'})}>
            See Features ↓
          </button>
        </div>

        {/* Fake board visual removed */}
      </section>

      {/* ── Stats strip ── */}
      <div className="lp-stats">
        {[
          ['6', 'Training Modes'],
          ['Stockfish 18', 'Engine'],
          ['ChessDB', 'Global Explorer'],
          ['Chess.com + Lichess', 'Game Sources'],
          ['100%', 'Free'],
        ].map(([v, l]) => (
          <div key={l} className="lp-stat">
            <span className="lp-stat-v">{v}</span>
            <span className="lp-stat-l">{l}</span>
          </div>
        ))}
      </div>

      {/* ── Features ── */}
      <section id="features" className="lp-features">
        <div className="lp-section-tag">WHAT YOU GET</div>
        <h2 className="lp-section-title">Everything a chess coach needs.</h2>

        <div className="lp-feat-grid">
          {[
            { icon:'♟', color:'var(--green)', title:'AI Opening Coach', desc:'Lines drawn from your own game history. The coach steers toward positions where you score best.' },
            { icon:'🌐', color:'var(--gold)', title:'Opening Explorer', desc:'Global statistics powered by ChessDB — engine evaluations and win rates for every legal move.' },
            { icon:'⚡', color:'#5B9BD5', title:'Engine Training', desc:'Live Stockfish 18 in the browser. Eval bar, best move, and search depth on every position.' },
            { icon:'👥', color:'#C4874A', title:'vs Player Database', desc:"Enter any username. See their opening tendencies and practice against their favourite moves." },
            { icon:'🎯', color:'#9B59B6', title:'Custom Position', desc:'Load any FEN and analyse or train from that exact setup with full engine support.' },
            { icon:'♜', color:'var(--red)', title:'Play vs Stockfish', desc:'Full game against the engine at 5 difficulty levels — from beginner to master strength.' },
          ].map(f => (
            <div key={f.title} className="lp-feat-card">
              <div className="lp-feat-icon" style={{ color: f.color }}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="lp-how">
        <div className="lp-section-tag">HOW IT WORKS</div>
        <h2 className="lp-section-title">Three steps to better openings.</h2>
        <div className="lp-steps">
          {[
            { n:'01', title:'Import your games', desc:'Connect Chess.com or Lichess. We analyse your last 200+ games in seconds.' },
            { n:'02', title:'Pick your style', desc:'Answer 3–5 quick position questions so the coach learns what structures you prefer.' },
            { n:'03', title:'Start training', desc:'Open the board and get move suggestions, engine analysis, and global statistics — all at once.' },
          ].map(s => (
            <div key={s.n} className="lp-step">
              <div className="lp-step-n">{s.n}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-glow"/>
        <h2>Ready to train smarter?</h2>
        <p>Import your games in 30 seconds. No account needed.</p>
        <button className="lp-btn-primary" onClick={onStart}>
          Get Started — It's Free →
        </button>
      </section>

    </div>
  );
}
