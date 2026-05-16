import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors, useArrowColors, useTheme, ARROW_BASE_COLOR } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpening, detectOpeningByMoves } from '../utils/openingDetector';
import './TrainVsPlayer.css';
import { CHESS_PIECES } from './boardPieces';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
const SOURCES = [
  { id: 'chess.com', label: 'Chess.com' },
  { id: 'lichess',   label: 'Lichess'   },
];

function freqToArrowColor(ratio, isMyMove, rgb) {
  const alpha = isMyMove
    ? (0.45 + ratio * 0.55).toFixed(2)
    : (0.25 + ratio * 0.45).toFixed(2);
  return `rgba(${rgb},${alpha})`;
}

function buildArrows(moves, fen, isMyMove, rgb) {
  if (!moves || moves.length === 0) return [];
  const totalFreq = moves.reduce((s, m) => s + (m.total || 1), 0);
  const arrows = [];
  try {
    const legal = new Set(new Chess(fen).moves({ verbose: true }).map(m => m.from + m.to));
    for (const mv of moves.slice(0, 6)) {
      try {
        const tmp = new Chess(fen);
        const result = tmp.move(mv.san);
        if (!result || !legal.has(result.from + result.to)) continue;
        const ratio = (mv.total || 1) / totalFreq;
        arrows.push([result.from, result.to, freqToArrowColor(ratio, isMyMove, rgb)]);
      } catch { /* skip invalid */ }
    }
  } catch { /* invalid fen */ }
  return arrows;
}


function useEvalBar() {
  const engineRef    = React.useRef(null);
  const readyRef     = React.useRef(false);
  const isSearchRef  = React.useRef(false); // true while engine is actively searching
  const nextFenRef   = React.useRef(null);  // fen queued to analyse after engine stops
  const stoppingRef  = React.useRef(false); // true between 'stop' and 'bestmove'
  const lastFenRef   = React.useRef('');
  const [score, setScore]       = React.useState(0);
  const [topMoves, setTopMoves] = React.useState([]);

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;
    engine.onerror = (e) => { console.warn('Stockfish worker error:', e); };
    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line === 'uciok') {
        engine.postMessage('setoption name MultiPV value 5');
        engine.postMessage('ucinewgame');
        engine.postMessage('isready');
        return;
      }
      if (line === 'readyok') {
        readyRef.current = true;
        if (nextFenRef.current) {
          engine.postMessage(`position fen ${nextFenRef.current}`);
          engine.postMessage('go depth 16');
          isSearchRef.current = true;
          nextFenRef.current = null;
          stoppingRef.current = false;
        }
        return;
      }
      if (line.startsWith('bestmove')) {
        isSearchRef.current = false;
        stoppingRef.current = false;
        if (nextFenRef.current) {
          engine.postMessage(`position fen ${nextFenRef.current}`);
          engine.postMessage('go depth 16');
          isSearchRef.current = true;
          nextFenRef.current = null;
        }
        return;
      }
      // Drop all info messages while stopping — they belong to the previous position
      if (stoppingRef.current) return;

      const pvMatch = line.match(/multipv (\d+)/);
      const rank = pvMatch ? parseInt(pvMatch[1]) - 1 : -1;
      const isLine1 = rank <= 0; // multipv 1 or no multipv tag

      // Parse score for this PV line
      let lineScore = null;
      if (line.includes('score cp')) {
        const m = line.match(/score cp (-?\d+)/);
        if (m) {
          const turn = lastFenRef.current.split(' ')[1];
          const raw = parseInt(m[1]);
          lineScore = parseFloat(((turn === 'b' ? -raw : raw) / 100).toFixed(1));
        }
      } else if (line.includes('score mate')) {
        const m = line.match(/score mate (-?\d+)/);
        if (m) {
          const turn = lastFenRef.current.split(' ')[1];
          const raw = parseInt(m[1]);
          lineScore = (turn === 'b' ? -raw : raw) > 0 ? 99 : -99;
        }
      }

      if (isLine1 && lineScore !== null) setScore(lineScore);

      // Parse first move of PV and convert to SAN
      const moveMatch = line.match(/\bpv ([a-h][1-8])([a-h][1-8])([qrbn])?/);
      if (moveMatch && rank >= 0 && rank < 4) {
        const from = moveMatch[1], to = moveMatch[2], promo = moveMatch[3];
        let san = from + to;
        try {
          const tmp = new Chess(lastFenRef.current);
          const result = tmp.move({ from, to, promotion: promo || 'q' });
          if (result) san = result.san;
        } catch { /* keep UCI notation as fallback */ }
        setTopMoves(prev => {
          const next = [...prev];
          next[rank] = { from, to, san, score: lineScore };
          return next;
        });
      }
    };
    engine.postMessage('uci');
    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engineRef.current) return;
    lastFenRef.current = fen;
    setTopMoves([]);
    if (!readyRef.current) {
      nextFenRef.current = fen;
      return;
    }
    if (isSearchRef.current) {
      // Engine is searching — queue fen and stop; analysis resumes on 'bestmove'
      nextFenRef.current = fen;
      stoppingRef.current = true;
      engineRef.current.postMessage('stop');
    } else {
      // Engine is idle — start immediately
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage('go depth 16');
      isSearchRef.current = true;
    }
  }, []);

  return { score, analyse, topMoves };
}

function EvalBar({ score, playerColor, boardSize }) {
  // score is already from white's perspective (positive = white better) — no flip needed
  const whitePct = Math.min(90, Math.max(10, 50 + score * 4));
  const blackPct = 100 - whitePct;
  // flip perspective so the player's color is at the bottom
  const bottomPct = playerColor === 'white' ? whitePct : blackPct;
  const topPct    = 100 - bottomPct;
  const evalStr = score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  return (
    <div className="tvp-eval-wrap">
      <div className="tvp-eval-bar-outer" style={{ height: boardSize }}>
        <div className="tvp-eval-bar-fill" style={{ flex: topPct }} />
        <div className="tvp-eval-bar-white" style={{ flex: bottomPct }} />
      </div>
      <div className="tvp-eval-score">{evalStr}</div>
    </div>
  );
}

const ENGINE_MOVE_COLORS = ['#a78bfa', '#34d399', '#fbbf24', '#38bdf8'];

function EnginePanel({ topMoves }) {
  const visible = topMoves.filter(Boolean).slice(0, 4);
  if (visible.length === 0) return null;
  return (
    <div className="tvp-engine-panel">
      <div className="tvp-engine-header">
        <span className="tvp-engine-bolt">⚡</span> ENGINE
      </div>
      <div className="tvp-engine-grid">
        {visible.map((mv, i) => {
          const s = mv.score;
          const scoreStr = s === null ? '—'
            : s >= 99 ? 'M+'
            : s <= -99 ? 'M−'
            : (s >= 0 ? `+${s.toFixed(2)}` : s.toFixed(2));
          return (
            <div key={i} className="tvp-engine-card">
              <span className="tvp-engine-san" style={{ color: ENGINE_MOVE_COLORS[i] }}>{mv.san}</span>
              <span className="tvp-engine-score">{scoreStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultsBar({ wins, draws, losses }) {
  const total = wins + draws + losses || 1;
  const wp = Math.round((wins / total) * 100);
  const dp = Math.round((draws / total) * 100);
  const lp = 100 - wp - dp;
  return (
    <div className="tvp-results-bar">
      <div className="tvp-rb-win"  style={{ width: `${wp}%` }}>{wp > 8 ? wp : ''}</div>
      <div className="tvp-rb-draw" style={{ width: `${dp}%` }}>{dp > 8 ? dp : ''}</div>
      <div className="tvp-rb-loss" style={{ width: `${lp}%` }}>{lp > 8 ? lp : ''}</div>
    </div>
  );
}

export default function TrainVsPlayer({ username: myUsername, source: mySource }) {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const { theme } = useTheme();
  const arrowRgb = ARROW_BASE_COLOR[theme] || ARROW_BASE_COLOR.classic;
  const [phase, setPhase] = useState('setup');
  const [opponentUsername, setOpponentUsername] = useState('');
  const [oppSource, setOppSource] = useState('chess.com');
  const [playerColor, setPlayerColor] = useState('white');
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState('');

  // Explorer state
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(new Chess().fen());
  const [lastMove, setLastMove] = useState(null);
  const [moves, setMoves] = useState([]);       // [{san, total, wins, draws, losses}]
  const [movesLoading, setMovesLoading] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]); // previous FENs for undo
  const [sanHistory, setSanHistory] = useState([]);   // display: ['e4','e5',...]
  const [fenHistory, setFenHistory] = useState([new Chess().fen()]); // all FENs for opening detection
  const [contextText, setContextText] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);

  const { score, analyse, topMoves } = useEvalBar();

  const myColor = playerColor === 'white' ? 'w' : 'b';
  const isMyTurn = game.turn() === myColor;
  const arrows = useMemo(
    () => buildArrows(moves, fen, isMyTurn, arrowRgb),
    [moves, fen, isMyTurn, arrowRgb]
  );

  // Progress ticker while loading
  useEffect(() => {
    if (!loading) { setLoadProgress(0); return; }
    const iv = setInterval(() => {
      setLoadProgress(p => p >= 92 ? 92 : p + Math.floor(Math.random() * 4) + 1);
    }, 600);
    return () => clearInterval(iv);
  }, [loading]);

  // Fetch moves for any position
  const fetchMoves = useCallback(async (currentFen, currentGame) => {
    const isMyTurn = currentGame.turn() === myColor;
    const user = isMyTurn ? myUsername : opponentUsername;
    const src  = isMyTurn ? (mySource || 'chess.com') : oppSource;
    if (!user) return;

    setMovesLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/opponent-moves`, {
        params: { username: user, source: src, fen: currentFen },
      });
      const mvs = res.data?.moves || [];
      setMoves(mvs);
      setContextText(
        isMyTurn
          ? `Showing moves played by ${myUsername} (you) in this position. Playing as ${playerColor}.`
          : `Showing moves played by ${opponentUsername} in this position.`
      );
    } catch {
      setMoves([]);
      setContextText('No data for this position.');
    } finally {
      setMovesLoading(false);
    }
  }, [myColor, myUsername, mySource, opponentUsername, oppSource, playerColor]);

  // Play a move (from list click or piece drag)
  function applyMove(san) {
    const g = new Chess(game.fen());
    let move;
    try { move = g.move(san); } catch { return false; }
    if (!move) return false;

    setMoveHistory(h => [...h, game.fen()]);
    setSanHistory(h => [...h, move.san]);
    setFenHistory(h => [...h, g.fen()]);
    setGame(g);
    setFen(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setMoves([]);
    fetchMoves(g.fen(), g);
    analyse(g.fen());   // also calls setTopMoves([]) internally
    return true;
  }

  function onDrop(from, to) {
    const g = new Chess(game.fen());
    let move;
    try { move = g.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    setSelectedSquare(null);
    return applyMove(move.san);
  }

  function onSquareClick(square) {
    if (selectedSquare) {
      const g = new Chess(game.fen());
      let move;
      try { move = g.move({ from: selectedSquare, to: square, promotion: 'q' }); } catch {}
      if (move) { setSelectedSquare(null); applyMove(move.san); return; }
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
      else setSelectedSquare(null);
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
    }
  }

  function handleBack() {
    if (moveHistory.length === 0) return;
    const prevFen = moveHistory[moveHistory.length - 1];
    const g = new Chess(prevFen);
    setMoveHistory(h => h.slice(0, -1));
    setSanHistory(h => h.slice(0, -1));
    setFenHistory(h => h.slice(0, -1));
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setMoves([]);
    setSelectedSquare(null);
    fetchMoves(g.fen(), g);
    analyse(g.fen());
  }

  function handleReset() {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setMoveHistory([]);
    setSanHistory([]);
    setFenHistory([g.fen()]);
    setMoves([]);
    setSelectedSquare(null);
    fetchMoves(g.fen(), g);
    analyse(g.fen());
  }

  // Load opponent on start
  async function handleStart(e) {
    e.preventDefault();
    if (!opponentUsername.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/opponent-moves`, {
        params: { username: opponentUsername.trim(), source: oppSource, fen: new Chess().fen() },
      });
      setTotalGames(res.data?.total_games || 0);
      if (!res.data?.total_games) {
        setError(`No games found for ${opponentUsername} on ${oppSource}.`);
        setLoadProgress(100);
        setTimeout(() => setLoading(false), 300);
        return;
      }
      const g = new Chess();
      setGame(g); setFen(g.fen());
      setMoveHistory([]); setSanHistory([]); setFenHistory([g.fen()]);
      setLastMove(null);
      const mvs = res.data?.moves || [];
      setMoves(mvs);
      setContextText(
        g.turn() === myColor
          ? `Showing moves played by ${myUsername} (you) in this position. Playing as ${playerColor}.`
          : `Showing moves played by ${opponentUsername} in this position.`
      );
      setLoadProgress(100);
      setTimeout(() => { setLoading(false); setPhase('game'); }, 300);
      analyse(g.fen());
    } catch (err) {
      const d = err.response?.data?.detail;
      setError(typeof d === 'string' ? d : Array.isArray(d) ? d.map(e => e.msg).join('; ') : `Could not load games for ${opponentUsername}.`);
      setLoadProgress(100);
      setTimeout(() => setLoading(false), 300);
    }
  }

  const legalMoveDots = {};
  if (selectedSquare) {
    game.moves({ square: selectedSquare, verbose: true }).forEach(m => {
      legalMoveDots[m.to] = {
        background: game.get(m.to)
          ? 'radial-gradient(circle, rgba(0,0,0,.35) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.25) 30%, transparent 30%)',
        borderRadius: '50%',
      };
    });
  }
  const customSquareStyles = {
    ...(lastMove ? {
      [lastMove.from]: { background: 'rgba(229,139,0,0.3)' },
      [lastMove.to]:   { background: 'rgba(229,139,0,0.4)' },
    } : {}),
    ...(selectedSquare ? { [selectedSquare]: { background: 'rgba(255,215,0,0.55)' } } : {}),
    ...legalMoveDots,
  };

  // Format move history pairs: "1.e4 e5  2.Nf3 Nc6"
  const historyPairs = [];
  for (let i = 0; i < sanHistory.length; i += 2) {
    historyPairs.push({ n: Math.floor(i / 2) + 1, w: sanHistory[i], b: sanHistory[i + 1] });
  }

  /* ── Setup phase ── */
  if (phase === 'setup') {
    return (
      <div className="tvp-root">
        <div className="tvp-setup">
          <h2 className="tvp-title">Train vs Player Database</h2>
          <p className="tvp-sub">
            Explore any player's opening repertoire. See what moves they play from any position and practice against their patterns.
          </p>

          <form onSubmit={handleStart} className="tvp-form">
            <div className="tvp-field-label">Play as</div>
            <div className="tvp-color-row">
              {['white', 'black'].map(c => (
                <button key={c} type="button"
                  className={`tvp-color-btn ${playerColor === c ? 'tvp-color-active' : ''}`}
                  onClick={() => setPlayerColor(c)}
                >
                  <span>{c === 'white' ? '♔' : '♚'}</span>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            <div className="tvp-field-label">Opponent platform</div>
            <div className="tvp-source-row">
              {SOURCES.map(s => (
                <button key={s.id} type="button"
                  className={`tvp-source-btn ${oppSource === s.id ? 'tvp-source-active' : ''}`}
                  onClick={() => setOppSource(s.id)}
                >{s.label}</button>
              ))}
            </div>

            <div className="tvp-field-label">Opponent username</div>
            <div className="tvp-input-row">
              <input className="tvp-username-input" value={opponentUsername}
                onChange={e => setOpponentUsername(e.target.value)}
                placeholder="Enter username…" disabled={loading} autoFocus />
              <button type="submit" className="tvp-search-btn"
                disabled={loading || !opponentUsername.trim()}>
                {loading ? `${loadProgress}%` : 'Load Games →'}
              </button>
            </div>

            {loading && (
              <div className="tvp-progress-wrap">
                <div className="tvp-progress-label">
                  Fetching games for <strong>{opponentUsername}</strong>… this may take a moment
                </div>
                <div className="tvp-progress-bar-outer">
                  <div className="tvp-progress-bar-fill" style={{ width: `${loadProgress}%` }} />
                </div>
                <div className="tvp-progress-pct">{loadProgress}%</div>
              </div>
            )}
            {!loading && error && <div className="tvp-error">{error}</div>}
          </form>

          <div className="tvp-legend">
            <div className="tvp-legend-title">Arrow guide</div>
            <div className="tvp-legend-row">
              <div className="tvp-legend-arrow" style={{ background: `rgba(${arrowRgb},0.9)` }} />
              <span>Your moves — darker = more frequent</span>
            </div>
            <div className="tvp-legend-row">
              <div className="tvp-legend-arrow" style={{ background: `rgba(${arrowRgb},0.5)` }} />
              <span>Opponent moves — darker = more frequent</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Explorer phase ── */
  const boardSize = Math.min(500, window.innerWidth - 340);
  const opening = detectOpening(fenHistory) || detectOpeningByMoves(sanHistory);

  return (
    <div className="tvp-root">
      <div className="tvp-game-layout">

        {/* Board + eval + history (stacked as column) */}
        <div className="tvp-board-col">
          <div className="tvp-board-row">
            <EvalBar score={score} playerColor={playerColor} boardSize={boardSize} />
            <div className="tvp-board-wrap" style={{ width: boardSize }}>
              <Chessboard customPieces={CHESS_PIECES}
                position={fen}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation={playerColor}
                customArrows={arrows}
                customArrowColor="rgba(0,0,0,0)"
                boardWidth={boardSize}
                customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
                customDarkSquareStyle={{ backgroundColor: boardDark }}
                customLightSquareStyle={{ backgroundColor: boardLight }}
                customSquareStyles={customSquareStyles}
              />
            </div>
          </div>

          {/* Opening name */}
          <OpeningBadge opening={opening} />

          {/* Move history below board */}
          {sanHistory.length > 0 && (
            <div className="tvp-history" style={{ maxWidth: boardSize + 22 }}>
              {historyPairs.map(({ n, w, b }) => (
                <span key={n} className="tvp-history-pair">
                  <span className="tvp-history-num">{n}.</span>
                  <span className="tvp-history-san">{w}</span>
                  {b && <span className="tvp-history-san">{b}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Explorer panel */}
        <div className="tvp-side">

          {/* Opponent card */}
          <div className="tvp-opp-card">
            <div className="tvp-opp-avatar">{opponentUsername[0]?.toUpperCase()}</div>
            <div>
              <div className="tvp-opp-name">{opponentUsername}</div>
              <div className="tvp-opp-meta">{totalGames.toLocaleString()} games · {oppSource}</div>
            </div>
          </div>

          {/* Engine suggestions — above moves so always visible */}
          <EnginePanel topMoves={topMoves} />

          {/* Moves table */}
          <div className="tvp-moves-panel">
            <div className="tvp-moves-header">
              <span>Move</span>
              <span>Games</span>
              <span>Results</span>
            </div>

            {movesLoading ? (
              <div className="tvp-moves-loading">Loading…</div>
            ) : moves.length === 0 ? (
              <div className="tvp-moves-empty">No data for this position</div>
            ) : (
              moves.map((mv, i) => (
                <button key={mv.san} className="tvp-move-row" onClick={() => applyMove(mv.san)}>
                  <span className="tvp-move-san">{mv.san}</span>
                  <span className="tvp-move-games">{mv.total}</span>
                  <div className="tvp-move-results">
                    <ResultsBar wins={mv.wins} draws={mv.draws} losses={mv.losses} />
                  </div>
                </button>
              ))
            )}

            {/* Context */}
            {contextText && (
              <div className="tvp-context">{contextText}</div>
            )}
          </div>

          {/* Nav buttons */}
          <div className="tvp-btns">
            <button className="tvp-nav-btn" onClick={handleBack} disabled={moveHistory.length === 0}>
              ← Back
            </button>
            <button className="tvp-nav-btn" onClick={handleReset}>
              ↺ Reset
            </button>
            <button className="tvp-nav-btn tvp-change-btn" onClick={() => setPhase('setup')}>
              Change Player
            </button>
          </div>

          {/* Turn indicator */}
          <div className="tvp-turn-indicator">
            <div className={`tvp-turn-dot ${isMyTurn ? 'tvp-dot-mine' : 'tvp-dot-opp'}`} />
            <span>{isMyTurn ? `${myUsername}'s turn (you)` : `${opponentUsername}'s turn`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
