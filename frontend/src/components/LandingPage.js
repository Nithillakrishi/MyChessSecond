import React, { useState, useEffect, useRef } from 'react';
import ThemePicker from './ThemePicker';
import './LandingPage.css';

/* ──────────────────────────────────────────────────────────
   Logo — kept unchanged so App.js's import { Logo } still works.
   ────────────────────────────────────────────────────────── */
export function Logo({ size = 40 }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      {/* Board-square background — picks up theme surface */}
      <rect width="48" height="48" rx="10" fill="var(--bg-3)" />
      <rect x="0.5" y="0.5" width="47" height="47" rx="9.5" fill="none"
            stroke="var(--border-mid)" strokeWidth="1" />
      {/* Checkerboard corner squares using theme accents */}
      <rect x="0"  y="0"  width="10" height="10" rx="3" fill="var(--gold)"  opacity="0.28"/>
      <rect x="38" y="0"  width="10" height="10"        fill="var(--green)" opacity="0.28"/>
      <rect x="0"  y="38" width="10" height="10"        fill="var(--green)" opacity="0.28"/>
      <rect x="38" y="38" width="10" height="10"        fill="var(--gold)"/>
      {/* "2" — main glyph in the theme's cream/foreground */}
      <text x="18" y="36" textAnchor="middle" fill="var(--cream)"
            fontSize="26" fontWeight="900"
            fontFamily="'Syne', Georgia, 'Times New Roman', serif">2</text>
      {/* "nd" superscript in the warm theme accent */}
      <text x="33" y="22" textAnchor="middle" fill="var(--gold)"
            fontSize="12" fontWeight="800"
            fontFamily="'JetBrains Mono', ui-monospace, monospace">nd</text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   CSS chessboard — Sicilian position after 1.e4 c5
   Pieces as unicode glyphs. Arrow drawn via SVG overlay.
   ────────────────────────────────────────────────────────── */
const HERO_POSITION = [
  '♜♞♝♛♚♝♞♜',
  '♟♟.♟♟♟♟♟',
  '........',
  '..♟.....',
  '....♙...',
  '........',
  '♙♙♙♙.♙♙♙',
  '♖♘♗♕♔♗♘♖',
];
const WHITE_PIECES = '♙♘♗♖♕♔';

function HeroBoard() {
  // Highlighted squares: e4 (white played), c5 (black response).
  const highlight = new Set(['e4', 'c5']);
  // Best-move arrow we suggest visually: g1 → f3 (white's main continuation).
  const sq = 56;
  return (
    <div className="lp-board" style={{ '--sq': `${sq}px` }}>
      {Array.from({ length: 64 }).map((_, i) => {
        const x = i % 8;
        const y = Math.floor(i / 8);
        const file = 'abcdefgh'[x];
        const rank = 8 - y;
        const id = `${file}${rank}`;
        const dark = (x + y) % 2 === 1;
        const piece = HERO_POSITION[y][x];
        const isHi = highlight.has(id);
        return (
          <div key={id}
               className={`lp-board-sq ${dark ? 'dark' : 'light'} ${isHi ? 'hi' : ''}`}>
            {piece !== '.' && (
              <span className={WHITE_PIECES.includes(piece) ? 'pc-w' : 'pc-b'}>{piece}</span>
            )}
          </div>
        );
      })}
      <svg className="lp-board-arrow" viewBox={`0 0 ${sq * 8} ${sq * 8}`} preserveAspectRatio="none">
        <defs>
          <marker id="lpHead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="var(--lp-accent)" />
          </marker>
        </defs>
        {/* g1 (x=6,y=7) → f3 (x=5,y=5) */}
        <line
          x1={6 * sq + sq / 2} y1={7 * sq + sq / 2}
          x2={5 * sq + sq / 2} y2={5 * sq + sq / 2}
          stroke="var(--lp-accent)" strokeWidth="6"
          markerEnd="url(#lpHead)" opacity="0.95" />
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Animated eval bar
   ────────────────────────────────────────────────────────── */
function EvalBar({ value = 0.42 }) {
  // value in pawns. clamp to [-3, 3] for display.
  const v = Math.max(-3, Math.min(3, value));
  const whitePct = 50 + (v / 3) * 38; // 12-88%
  return (
    <div className="lp-eval-bar">
      <div className="lp-eval-fill" style={{ height: `${whitePct}%` }} />
      <div className="lp-eval-mid" />
      <div className="lp-eval-num">+{v.toFixed(2)}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Live demo terminal — fake scan animation
   ────────────────────────────────────────────────────────── */
const DEMO_USERS = ['NithilPY', 'magnuscarlsen', 'hikaru', 'gothamchess'];
const DEMO_SEQ = [
  '> ✓ 4,218 games · 1843 as white · 2375 as black',
  '> classifying positions...',
  '> matching to 142 known structures...',
  '> top fit: ClosedPositional · win 0.71',
  '> recommend: 1.c4 / 1.d4 / 1.Nf3',
  '> ✓ profile written',
];

function LiveDemo() {
  const [user, setUser] = useState('NithilPY');
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState([
    '> connect chess.com/NithilPY',
    ...DEMO_SEQ,
  ]);
  const [barsVisible, setBarsVisible] = useState(false);
  const demoRef = useRef(null);

  // Trigger bar reveal when section enters viewport
  useEffect(() => {
    if (!demoRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setBarsVisible(true); });
    }, { threshold: 0.3 });
    obs.observe(demoRef.current);
    return () => obs.disconnect();
  }, []);

  const run = () => {
    if (scanning) return;
    setScanning(true);
    setLog([`> connect chess.com/${user || 'anonymous'}`]);
    let i = 0;
    const id = setInterval(() => {
      setLog((prev) => prev.concat([DEMO_SEQ[i]]));
      i += 1;
      if (i === DEMO_SEQ.length) {
        clearInterval(id);
        setScanning(false);
      }
    }, 360);
  };

  const profile = [
    { k: 'Fianchetto',         w: 0.71, cls: 'good' },
    { k: 'ClosedPositional',   w: 0.68, cls: 'good' },
    { k: 'KingsideAttack',     w: 0.64, cls: 'good' },
    { k: 'CentralControl',     w: 0.58, cls: '' },
    { k: 'IsolatedQueensPawn', w: 0.46, cls: '' },
    { k: 'OpenSiciliansSharp', w: 0.39, cls: 'bad' },
    { k: 'SharpTactical',      w: 0.32, cls: 'bad' },
  ];

  return (
    <section className="lp-demo" ref={demoRef}>
      <div className="lp-demo-glyph" aria-hidden="true">♘</div>
      <div className="lp-demo-inner">
        <div className="lp-section-head">
          <div>
            <div className="lp-mono-tag">// 04 · LIVE DEMO</div>
            <h2 className="lp-section-title">
              Type a username.<br/><span className="em">Watch yourself.</span>
            </h2>
          </div>
          <p className="lp-section-title-sub">
            We profile your last 4,000 games in under a minute. No signup, no card, no setup.
          </p>
        </div>

        <div className="lp-demo-grid">
          {/* Terminal */}
          <div className="lp-term">
            <div className="lp-term-bar">
              <i /><i /><i className="live" />
              <span>~/chess-second — scan.sh</span>
            </div>
            <div className="lp-term-input">
              <span className="prompt">$</span>
              <span className="cmd">scan</span>
              <input value={user} onChange={(e) => setUser(e.target.value)}
                     placeholder="chess.com or lichess username"
                     list="lp-demo-users" />
              <datalist id="lp-demo-users">
                {DEMO_USERS.map((u) => <option key={u} value={u} />)}
              </datalist>
              <button onClick={run} disabled={scanning}>
                {scanning ? 'SCANNING' : 'RUN ↵'}
              </button>
            </div>
            <div className="lp-term-log">
              {log.map((l, i) => (
                <div key={i} className={l.includes('✓') ? 'ok' : 'line'}>{l}</div>
              ))}
              {scanning && <span className="caret">▌</span>}
            </div>
          </div>

          {/* Profile preview */}
          <div className="lp-profile">
            <div className="lp-profile-head">
              <div className="meta">
                <div className="k">Profile · @{(user || 'you').toUpperCase()}</div>
                <div className="v">style = <em>Closed / Positional</em></div>
              </div>
              <div className="elo">
                <div className="num">1847</div>
                <div className="lbl">rapid elo</div>
              </div>
            </div>

            <div className="lp-profile-bars">
              {profile.map(({ k, w, cls }) => (
                <div key={k} className={`lp-profile-bar ${cls}`}>
                  <div className="k">{k}</div>
                  <div className="track">
                    <div className="fill" style={{ width: barsVisible ? `${w * 100}%` : 0 }} />
                  </div>
                  <div className="v">{(w * 100).toFixed(0)}%</div>
                </div>
              ))}
            </div>

            <div className="lp-profile-foot">
              <div className="cell"><div className="n">71%</div><div className="l">best structure</div></div>
              <div className="cell"><div className="n">32%</div><div className="l">worst structure</div></div>
              <div className="cell"><div className="n ok">+39 ELO</div><div className="l">if matched</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────────── */
export default function LandingPage({ onStart }) {
  const features = [
    { icon: '♟', title: 'AI Opening Coach',     desc: 'Lines drawn from your own game history. The coach steers toward positions where you actually score.',          tag: 'PERSONAL' },
    { icon: '♘', title: 'Opening Explorer',     desc: 'Global statistics powered by ChessDB — engine evals and win rates for every legal move.',                       tag: 'GLOBAL' },
    { icon: '♖', title: 'Engine Training',      desc: 'Stockfish 18 in the browser. Eval bar, best move, and search depth on every position.',                          tag: 'LIVE' },
    { icon: '♚', title: 'vs Player Database',   desc: 'Enter any username. See their opening tendencies — and practice against their favourite moves.',                  tag: 'SCOUT' },
    { icon: '♕', title: 'Game Analysis',         desc: 'Import any PGN, navigate moves, branch into variations, and get Stockfish analysis at every position.',        tag: 'STUDIO' },
    { icon: '♔', title: 'Play vs Stockfish',    desc: 'Full game against the engine across five difficulty levels — beginner to master strength.',                       tag: 'COMBAT' },
  ];

  const steps = [
    {
      n: '01', glyph: '♟', title: 'Import your games',
      desc: 'Connect Chess.com or Lichess. We pull your last 200+ games in seconds — no installs, no plugins.',
      code: ['> connect chess.com/you', '> fetching 4,218 games...', '✓ parsed in 11.4s'],
    },
    {
      n: '02', glyph: '♞', title: 'Profile your style',
      desc: 'We classify every position you\'ve reached by structure, then tell you exactly which ones win for you.',
      code: ['> running player_profiler...', '> 14/142 structures reached', '✓ profile written'],
    },
    {
      n: '03', glyph: '♚', title: 'Train your repertoire',
      desc: 'A board, an engine, and lines built around the player you already are — not the player you wish you were.',
      code: ['> matching openings to profile...', '> 12 lines · 84 critical positions', '✓ ready to train'],
    },
  ];

  const stats = [
    ['6',      'Training Modes'],
    ['SF 18',  'Engine'],
    ['ChessDB','Global Explorer'],
    ['c.com + Lichess', 'Game Sources'],
    ['100%',   'Free'],
  ];

  const quotes = [
    { q: 'I spent two years on the Najdorf because it looked cool. Chess Second said I\'m a positional player. +180 elo in six months.', a: 'Felix R.', m: '1640 → 1820' },
    { q: 'It surfaced a structure I\'d never tried and showed me I scored 78% in adjacent positions. That\'s my main weapon now.',         a: 'Priya S.', m: '1490 → 1610' },
    { q: 'Felt like having a coach who actually read my games instead of guessing at what I should play.',                                  a: 'Daniel K.', m: '1880 → 1965' },
  ];

  return (
    <div className="lp">
      {/* ───── NAV ───── */}
      <nav className="lp-nav">
        <div className="lp-nav-brand">
          <Logo size={34} />
          <span>MyChess<strong>2nd</strong></span>
        </div>
        <div className="lp-nav-links">
          <a href="#features">Product</a>
          <a href="#how">Method</a>
          <a href="#demo">Demo</a>
          <a href="#field">Players</a>
        </div>
        <div className="lp-nav-right">
          <ThemePicker />
          <button className="lp-nav-cta" onClick={onStart}>Get Started →</button>
        </div>
      </nav>

      {/* ───── HERO ───── */}
      <section className="lp-hero">
        <div className="lp-hero-glyph" aria-hidden="true">♔</div>
        <div className="lp-hero-grid">
          <div className="lp-hero-left">
            <div className="lp-hero-tag">
              <span className="lp-dot" />
              CHESS_SECOND · v0.91 · STOCKFISH 18 ONLINE
            </div>
            <h1 className="lp-hero-title">
              <span>Stop memorizing</span>
              <span>openings that</span>
              <span className="lp-accent-word">aren't yours</span>
            </h1>
            <p className="lp-hero-sub">
              MyChess<strong>2nd</strong> reads every game you've ever played, finds the structures
              you actually win in, and builds a repertoire from the player you already are.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={onStart}>Import your games</button>
              <button className="lp-btn-ghost" onClick={() => {
                const el = document.getElementById('demo');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}>See sample profile</button>
            </div>
            <div className="lp-hero-meta">
              <span><strong>60s</strong> analysis</span>
              <span><strong>0</strong> signup friction</span>
              <span><strong>12,478</strong> players onboarded this week</span>
            </div>
          </div>

          <div className="lp-hero-right">
            <EvalBar value={0.42} />
            <div className="lp-board-wrap">
              <div className="lp-board-cap">▎ POSITION · 1.e4 c5 · YOU = WHITE</div>
              <HeroBoard />
              <div className="lp-board-readouts">
                depth <strong>24</strong> · 1.2M nps · 0.04s<br/>
                best: <strong className="ok">Nf3</strong> +0.42 · pv Nf3 d6 d4 cxd4<br/>
                alt: Nc3 +0.30 · c3 +0.22 · Bc4 +0.08
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── TICKER ───── */}
      <div className="lp-ticker">
        <div className="lp-ticker-row">
          {[
            '♔ 4.2M GAMES ANALYZED', '♛ 142 OPENING SYSTEMS', '♞ DEPTH 24',
            'NPS 1.2M', '♟ 84 CRITICAL POSITIONS', '+186 AVG ELO GAIN @ 6 MONTHS',
            '♜ EXPORTABLE TO CHESSABLE · LICHESS · PDF',
            '♔ 4.2M GAMES ANALYZED', '♛ 142 OPENING SYSTEMS', '♞ DEPTH 24',
            'NPS 1.2M', '♟ 84 CRITICAL POSITIONS', '+186 AVG ELO GAIN @ 6 MONTHS',
            '♜ EXPORTABLE TO CHESSABLE · LICHESS · PDF',
          ].map((t, i) => (
            <span key={i}><span className="dot">●</span>{t}</span>
          ))}
        </div>
      </div>

      {/* ───── STATS ───── */}
      <div className="lp-stats">
        {stats.map(([v, l]) => (
          <div key={l} className="lp-stat">
            <span className="lp-stat-v">{v}</span>
            <span className="lp-stat-l">{l}</span>
          </div>
        ))}
      </div>

      {/* ───── PROBLEM ───── */}
      <section className="lp-problem">
        <div className="lp-problem-head">
          <div>
            <div className="lp-mono-tag">// 01 · THE PROBLEM</div>
            <h2>
              You drilled the Najdorf for six weeks.<br/>
              You scored <span className="em-loss">32%</span> with it.<br/>
              <span className="em-dim">Your engine doesn't care what was supposed to suit you.</span>
            </h2>
          </div>
          <p className="lp-problem-kicker">
            We read your actual results — not your aspirations — then build a repertoire
            from the structures that already beat people for you.
          </p>
        </div>
        <div className="lp-problem-stats">
          <div className="lp-problem-stat">
            <div className="label">SHARP_TACTICAL</div>
            <div className="number bad">32%</div>
            <div className="sub">win rate · last 400 games</div>
            <div className="delta">−27 vs avg</div>
          </div>
          <div className="lp-problem-stat">
            <div className="label">CLOSED_POSITIONAL</div>
            <div className="number good">71%</div>
            <div className="sub">win rate · last 400 games</div>
            <div className="delta">+12 vs avg</div>
          </div>
          <div className="lp-problem-stat">
            <div className="label">KINGSIDE_ATTACK</div>
            <div className="number good">64%</div>
            <div className="sub">win rate · last 400 games</div>
            <div className="delta">+05 vs avg</div>
          </div>
        </div>
      </section>

      {/* ───── HOW IT WORKS ───── */}
      <section id="how" className="lp-how">
        <div className="lp-section-head">
          <div>
            <div className="lp-mono-tag">// 02 · HOW IT WORKS</div>
            <h2 className="lp-section-title">Three steps. <span className="em">Sixty seconds.</span></h2>
          </div>
          <p className="lp-section-title-sub">
            From a blank field to a personalized repertoire faster than you can pour a coffee.
          </p>
        </div>
        <div className="lp-steps">
          {steps.map((s) => (
            <div key={s.n} className="lp-step">
              <div className="lp-step-n">STEP / {s.n}</div>
              <div className="lp-step-glyph">{s.glyph}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <div className="lp-step-code">
                {s.code.map((l, i) => (
                  <div key={i} className={l.startsWith('✓') ? 'ok' : ''}>{l}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── FEATURES ───── */}
      <section id="features" className="lp-features">
        <div className="lp-section-head">
          <div>
            <div className="lp-mono-tag">// 03 · WHAT YOU GET</div>
            <h2 className="lp-section-title">Everything a chess coach needs.<br/><span className="em">In one window.</span></h2>
          </div>
          <p className="lp-section-title-sub">
            Six modes that share one engine, one game history, and one opinionated method.
          </p>
        </div>
        <div className="lp-feat-grid">
          {features.map((f, i) => (
            <div key={f.title} className="lp-feat-card" data-num={`/ ${String(i + 1).padStart(2, '0')}`}>
              <div className="lp-feat-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div className="lp-feat-tag">▎ {f.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── DEMO ───── */}
      <div id="demo">
        <LiveDemo />
      </div>

      {/* ───── TESTIMONIALS ───── */}
      <section id="field" className="lp-testimonials">
        <div className="lp-section-head">
          <div>
            <div className="lp-mono-tag">// 05 · FROM THE FIELD</div>
            <h2 className="lp-section-title">Players who stopped<br/><span className="em">guessing.</span></h2>
          </div>
        </div>
        <div className="lp-quotes">
          {quotes.map((q, i) => (
            <div key={i} className="lp-quote">
              <div className="glyphs">♔ ♕ ♖</div>
              <p>"{q.q}"</p>
              <div className="lp-quote-meta">
                <strong>{q.a}</strong>
                <span>{q.m}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="lp-cta-section">
        <div className="lp-cta-glyph" aria-hidden="true">♚</div>
        <div className="lp-mono-tag">// 06 · READY?</div>
        <h2>Compile<br/>your <span className="em">game.</span></h2>
        <p>One field. Sixty seconds. A repertoire that actually fits the player you are.</p>
        <form className="lp-cta-form" onSubmit={(e) => { e.preventDefault(); onStart?.(); }}>
          <input placeholder="chess.com or lichess username" />
          <button type="submit">Run →</button>
        </form>
        <div className="lp-cta-note">Free for the first 500 games · no card · cancel with one command</div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="lp-footer">
        <div className="lp-footer-grid">
          <div>
            <div className="lp-footer-brand">
              <Logo size={32} /> <span>MyChess<strong>2nd</strong></span>
            </div>
            <p className="lp-footer-tag">
              A second is what you bring to a duel. We bring the analysis.
              You bring the moves.
            </p>
          </div>
          {[
            ['PRODUCT', ['Coach', 'Explorer', 'Engine', 'Play vs SF']],
            ['LEARN',   ['Docs', 'Method', 'Changelog', 'API']],
            ['COMPANY', ['About', 'Pricing', 'Contact']],
            ['LEGAL',   ['Privacy', 'Terms', 'Status']],
          ].map(([h, items]) => (
            <div key={h} className="lp-footer-col">
              <h4>{h}</h4>
              {items.map((i) => <a key={i} href="#">{i}</a>)}
            </div>
          ))}
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 MYCHESS2ND · ALL RIGHTS RESERVED</span>
          <span>BUILD a3f7c1 · STOCKFISH 17.0 · NPS 1.2M</span>
        </div>
      </footer>
    </div>
  );
}
