import React, { useState, useCallback, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors } from '../contexts/ThemeContext';
import './TrainVsPlayer.css';

const API_BASE = 'http://localhost:8000';
const SOURCES = [
  { id: 'chess.com', label: 'Chess.com' },
  { id: 'lichess',   label: 'Lichess'   },
];

/* Arrow color from frequency ratio 0..1 → dark-to-light gold/green */
function freqToArrowColor(ratio, isMyMove) {
  const alpha = Math.round(0.25 + ratio * 0.75, 2).toFixed(2);
  return isMyMove
    ? `rgba(127,166,80,${alpha})`   // green for my moves
    : `rgba(229,139,0,${alpha})`;   // gold for opponent moves
}

/* Build arrows from move list [{san, total, ...}] */
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

/* Stockfish hook — only eval bar */
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
  // score is always from side-to-move's perspective — adjust to white's perspective
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

export default function TrainVsPlayer({ username: myUsername, source: mySource, profile }) {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [phase, setPhase] = useState('setup'); // setup | game
  const [opponentUsername, setOpponentUsername] = useState('');
  const [oppSource, setOppSource] = useState('chess.com');
  const [playerColor, setPlayerColor] = useState('white');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(new Chess().fen());
  const [arrows, setArrows] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [message, setMessage] = useState('');
  const [totalGames, setTotalGames] = useState(0);
  const [isThinking, setIsThinking] = useState(false);

  // Per-FEN arrow cache to avoid redundant requests
  const myArrowCache = React.useRef({});
  const oppArrowCache = React.useRef({});

  const { score, analyse } = useEvalBar();

  const myColor = playerColor === 'white' ? 'w' : 'b';

  /* Fetch moves from both databases and build arrows */
  const refreshArrows = useCallback(async (currentFen, currentGame) => {
    const isMyTurn = currentGame.turn() === myColor;

    if (isMyTurn) {
      // Show MY moves using /opponent-moves with my own username
      if (!myUsername) { setArrows([]); return; }

      if (myArrowCache.current[currentFen]) {
        setArrows(myArrowCache.current[currentFen]);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/opponent-moves`, {
          params: { username: myUsername, source: mySource || 'chess.com', fen: currentFen },
        });
        const arrs = buildArrows(res.data?.moves || [], currentFen, true);
        myArrowCache.current[currentFen] = arrs;
        setArrows(arrs);
      } catch {
        setArrows([]);
      }
    } else {
      // Show OPPONENT moves
      if (oppArrowCache.current[currentFen]) {
        setArrows(oppArrowCache.current[currentFen]);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/opponent-moves`, {
          params: { username: opponentUsername, source: oppSource, fen: currentFen },
        });
        const arrs = buildArrows(res.data?.moves || [], currentFen, false);
        oppArrowCache.current[currentFen] = arrs;
        setArrows(arrs);
      } catch {
        setArrows([]);
      }
    }
  }, [myColor, myUsername, mySource, opponentUsername, oppSource]);

  /* Load opponent games to start */
  async function handleStart(e) {
    e.preventDefault();
    if (!opponentUsername.trim()) return;
    setLoading(true);
    setError('');
    // Clear caches when loading a new opponent
    myArrowCache.current = {};
    oppArrowCache.current = {};
    try {
      const res = await axios.get(`${API_BASE}/opponent-moves`, {
        params: { username: opponentUsername.trim(), source: oppSource, fen: new Chess().fen() },
      });
      setTotalGames(res.data?.total_games || 0);
      if (!res.data?.total_games) {
        setError(`No games found for ${opponentUsername} on ${oppSource}.`);
        setLoading(false);
        return;
      }
      const g = new Chess();
      setGame(g);
      setFen(g.fen());
      setLastMove(null);
      setMessage(`Playing ${opponentUsername}'s openings. ${playerColor === 'white' ? 'You play white.' : 'You play black.'}`);
      setPhase('game');
      // Initial arrows
      setTimeout(() => refreshArrows(g.fen(), g), 100);
      analyse(g.fen());
    } catch (err) {
      setError(err.response?.data?.detail || `Could not load games for ${opponentUsername}.`);
    } finally {
      setLoading(false);
    }
  }

  /* Player makes a move */
  async function onDrop(from, to, piece) {
    if (game.turn() !== myColor) return false;
    if (isThinking) return false;

    const g = new Chess(game.fen());
    const move = g.move({ from, to, promotion: piece?.slice(-1)?.toLowerCase() || 'q' });
    if (!move) return false;

    setGame(g);
    setFen(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setArrows([]);
    setMessage('');
    analyse(g.fen());

    if (g.isGameOver()) {
      setMessage(g.isCheckmate() ? 'Checkmate!' : 'Game over.');
      return true;
    }

    // Opponent auto-responds
    setIsThinking(true);
    setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/opponent-moves`, {
          params: { username: opponentUsername, source: oppSource, fen: g.fen() },
        });
        const moves = res.data?.moves || [];
        let oppMove = null;

        if (moves.length > 0) {
          const top = moves.slice(0, 3);
          const totalF = top.reduce((s, m) => s + (m.total || 1), 0);
          let rand = Math.random() * totalF;
          for (const m of top) {
            rand -= (m.total || 1);
            if (rand <= 0) { oppMove = m.san; break; }
          }
          if (!oppMove) oppMove = top[0].san;
        }

        if (oppMove) {
          const g2 = new Chess(g.fen());
          let om;
          try { om = g2.move(oppMove); } catch { om = null; }
          if (om) {
            setGame(g2);
            setFen(g2.fen());
            setLastMove({ from: om.from, to: om.to });
            const matchMove = moves.find(m => m.san === om.san);
            const pct = matchMove
              ? Math.round((matchMove.total / moves.reduce((s, m) => s + m.total, 0)) * 100)
              : null;
            setMessage(pct
              ? `${opponentUsername} plays ${om.san} · ${pct}% of their games`
              : `${opponentUsername} plays ${om.san}`);
            analyse(g2.fen());
            if (g2.isGameOver()) setMessage(prev => prev + ' · Game over.');
            // Show MY move arrows now
            refreshArrows(g2.fen(), g2);
          }
        } else {
          setMessage(`${opponentUsername} has no data here — you can continue freely.`);
          refreshArrows(g.fen(), g);
        }
      } catch {
        setMessage('Could not fetch opponent move.');
        refreshArrows(g.fen(), g);
      } finally {
        setIsThinking(false);
      }
    }, 400);

    return true;
  }

  function resetGame() {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setArrows([]);
    setMessage(`New game. ${playerColor === 'white' ? 'You play white.' : 'You play black.'}`);
    refreshArrows(g.fen(), g);
    analyse(g.fen());
  }

  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(229,139,0,0.3)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(229,139,0,0.4)' };
  }

  /* ── Setup phase ── */
  if (phase === 'setup') {
    return (
      <div className="tvp-root">
        <div className="tvp-setup">
          <h2 className="tvp-title">Train vs Player Database</h2>
          <p className="tvp-sub">
            Practice against any player's opening repertoire. Arrows show their most common moves by frequency.
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
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="tvp-field-label">Opponent username</div>
            <div className="tvp-input-row">
              <input
                className="tvp-username-input"
                value={opponentUsername}
                onChange={e => setOpponentUsername(e.target.value)}
                placeholder="Enter username…"
                autoFocus
              />
              <button type="submit" className="tvp-search-btn"
                disabled={loading || !opponentUsername.trim()}>
                {loading ? 'Loading…' : 'Load Games →'}
              </button>
            </div>
            {error && <div className="tvp-error">{error}</div>}
          </form>

          <div className="tvp-legend">
            <div className="tvp-legend-title">Arrow guide</div>
            <div className="tvp-legend-row">
              <div className="tvp-legend-arrow tvp-arrow-green" />
              <span>Your moves (from your games) — darker = more frequent</span>
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

  /* ── Game phase ── */
  const isMyTurn = game.turn() === myColor;
  return (
    <div className="tvp-root">
      <div className="tvp-game-layout">
        {/* Board + eval bar */}
        <div className="tvp-board-col">
          <EvalBar score={score} playerColor={playerColor} isWhiteTurn={game.turn() === 'w'} />
          <div className="tvp-board-wrap">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={playerColor}
              customArrows={arrows}
              customArrowColor="rgba(0,0,0,0)"
              customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
              customDarkSquareStyle={{ backgroundColor: boardDark }}
              customLightSquareStyle={{ backgroundColor: boardLight }}
              customSquareStyles={customSquareStyles}
            />
          </div>
          {message && <div className="tvp-message">{message}</div>}
        </div>

        {/* Side panel */}
        <div className="tvp-side">
          <div className="tvp-opp-card">
            <div className="tvp-opp-avatar">{opponentUsername[0]?.toUpperCase()}</div>
            <div>
              <div className="tvp-opp-name">{opponentUsername}</div>
              <div className="tvp-opp-meta">{totalGames.toLocaleString()} games · {oppSource}</div>
            </div>
          </div>

          <div className="tvp-turn-card">
            <div className={`tvp-turn-dot ${isThinking ? 'tvp-dot-opp' : isMyTurn ? 'tvp-dot-mine' : 'tvp-dot-opp'}`} />
            <span className={isThinking ? 'tvp-thinking-lbl' : ''}>
              {isThinking ? 'Opponent thinking…' : isMyTurn ? 'Your turn' : 'Opponent to move'}
            </span>
          </div>

          <div className="tvp-legend-card">
            <div className="tvp-legend-title">Arrow guide</div>
            <div className="tvp-legend-row">
              <div className="tvp-legend-arrow tvp-arrow-green" />
              <span>Your moves (darker = more common)</span>
            </div>
            <div className="tvp-legend-row">
              <div className="tvp-legend-arrow tvp-arrow-gold" />
              <span>Opponent moves (darker = more common)</span>
            </div>
          </div>

          <div className="tvp-btns">
            <button className="tvp-reset-btn" onClick={resetGame}>↺ New Game</button>
            <button className="tvp-back-btn" onClick={() => setPhase('setup')}>← Change Player</button>
          </div>
        </div>
      </div>
    </div>
  );
}
