import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpening, detectOpeningByMoves } from '../utils/openingDetector';
import './TrainVsPlayer.css';

const API_BASE = 'http://localhost:8000';
const SOURCES = [
  { id: 'chess.com', label: 'Chess.com' },
  { id: 'lichess',   label: 'Lichess'   },
];

function freqToArrowColor(ratio, isMyMove) {
  const alpha = (0.25 + ratio * 0.75).toFixed(2);
  return isMyMove
    ? `rgba(127,166,80,${alpha})`
    : `rgba(229,139,0,${alpha})`;
}

function buildArrows(moves, fen, isMyMove) {
  if (!moves || moves.length === 0) return [];
  const totalFreq = moves.reduce((s, m) => s + (m.total || 1), 0);
  const arrows = [];
  try {
    for (const mv of moves.slice(0, 6)) {
      try {
        const tmp = new Chess(fen);
        const result = tmp.move(mv.san);
        if (!result) continue;
        const ratio = (mv.total || 1) / totalFreq;
        arrows.push([result.from, result.to, freqToArrowColor(ratio, isMyMove)]);
      } catch { /* skip invalid */ }
    }
  } catch { /* invalid fen */ }
  return arrows;
}

function useEvalBar() {
  const engineRef = React.useRef(null);
  const [score, setScore] = React.useState(0);

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;
    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line.startsWith('info') && line.includes('score cp')) {
        const m = line.match(/score cp (-?\d+)/);
        if (m) setScore(parseInt(m[1]) / 100);
      }
      if (line.startsWith('info') && line.includes('score mate')) {
        const m = line.match(/score mate (-?\d+)/);
        if (m) setScore(parseInt(m[1]) > 0 ? 99 : -99);
      }
    };
    engine.postMessage('uci');
    engine.postMessage('ucinewgame');
    engine.postMessage('isready');
    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engineRef.current) return;
    engineRef.current.postMessage('stop');
    engineRef.current.postMessage(`position fen ${fen}`);
    engineRef.current.postMessage('go depth 16');
  }, []);

  return { score, analyse };
}

function EvalBar({ score, playerColor, isWhiteTurn }) {
  const whiteScore = isWhiteTurn ? score : -score;
  const whitePct = Math.min(90, Math.max(10, 50 + whiteScore * 4));
  const displayPct = playerColor === 'white' ? whitePct : 100 - whitePct;
  return (
    <div className="tvp-eval-bar-outer">
      <div className="tvp-eval-bar-fill" style={{ height: `${100 - displayPct}%` }} />
      <div className="tvp-eval-score">{whiteScore >= 0 ? `+${whiteScore.toFixed(1)}` : whiteScore.toFixed(1)}</div>
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
  const [arrows, setArrows] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [moves, setMoves] = useState([]);       // [{san, total, wins, draws, losses}]
  const [movesLoading, setMovesLoading] = useState(false);
  const [totalGames, setTotalGames] = useState(0);
  const [moveHistory, setMoveHistory] = useState([]); // previous FENs for undo
  const [sanHistory, setSanHistory] = useState([]);   // display: ['e4','e5',...]
  const [fenHistory, setFenHistory] = useState([new Chess().fen()]); // all FENs for opening detection
  const [contextText, setContextText] = useState('');

  const { score, analyse } = useEvalBar();
  const myColor = playerColor === 'white' ? 'w' : 'b';

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
      setArrows(buildArrows(mvs, currentFen, isMyTurn));
      setContextText(
        isMyTurn
          ? `Showing moves played by ${myUsername} (you) in this position. Playing as ${playerColor}.`
          : `Showing moves played by ${opponentUsername} in this position.`
      );
    } catch {
      setMoves([]);
      setArrows([]);
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
    setArrows([]);
    fetchMoves(g.fen(), g);
    analyse(g.fen());
    return true;
  }

  function onDrop(from, to, piece) {
    const g = new Chess(game.fen());
    const move = g.move({ from, to, promotion: piece?.slice(-1)?.toLowerCase() || 'q' });
    if (!move) return false;
    return applyMove(move.san);
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
    setArrows([]);
    fetchMoves(g.fen(), g);
    analyse(g.fen());
  }

  function handleReset() {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setArrows([]);
    setMoveHistory([]);
    setSanHistory([]);
    setFenHistory([g.fen()]);
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
      setArrows(buildArrows(mvs, g.fen(), g.turn() === myColor));
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

  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(229,139,0,0.3)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(229,139,0,0.4)' };
  }

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
              <div className="tvp-legend-arrow tvp-arrow-green" />
              <span>Your moves — darker = more frequent</span>
            </div>
            <div className="tvp-legend-row">
              <div className="tvp-legend-arrow tvp-arrow-gold" />
              <span>Opponent moves — darker = more frequent</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Explorer phase ── */
  const isMyTurn = game.turn() === myColor;
  const boardSize = Math.min(500, window.innerWidth - 340);
  const opening = detectOpening(fenHistory) || detectOpeningByMoves(sanHistory);

  return (
    <div className="tvp-root">
      <div className="tvp-game-layout">

        {/* Board + eval + history (stacked as column) */}
        <div className="tvp-board-col">
          <div className="tvp-board-row">
            <EvalBar score={score} playerColor={playerColor} isWhiteTurn={game.turn() === 'w'} />
            <div className="tvp-board-wrap" style={{ width: boardSize }}>
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
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
