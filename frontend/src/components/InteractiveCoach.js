import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import './InteractiveCoach.css';

const API_BASE = 'http://localhost:8000';

const STYLE_LABELS = {
  Fianchetto: 'Fianchetto',
  CentralControl: 'Central Control',
  KingsideAttack: 'Kingside Attack',
  QueensideAttack: 'Queenside Attack',
  ClosedPositional: 'Closed Positional',
  SharpTactical: 'Sharp & Tactical',
  LongMiddlegame: 'Long Middlegame',
  EndgameApproaching: 'Endgame',
  Mixed: 'Mixed',
};

// ── Stockfish hook ──────────────────────────────────────────────────────────
function useStockfish() {
  const engineRef = useRef(null);
  const [sfInfo, setSfInfo] = useState({ score: 0, type: 'cp', depth: 0, bestMove: null, ready: false });

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;

    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);

      if (line === 'readyok') {
        setSfInfo(p => ({ ...p, ready: true }));
        return;
      }

      // Parse score from info lines
      if (line.startsWith('info') && line.includes('score')) {
        const cpMatch   = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const depthMatch = line.match(/\bdepth (\d+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;

        if (mateMatch) {
          setSfInfo(p => ({ ...p, score: parseInt(mateMatch[1]), type: 'mate', depth }));
        } else if (cpMatch) {
          setSfInfo(p => ({ ...p, score: parseInt(cpMatch[1]) / 100, type: 'cp', depth }));
        }
      }

      if (line.startsWith('bestmove')) {
        const m = line.match(/bestmove (\S+)/);
        if (m && m[1] !== '(none)') setSfInfo(p => ({ ...p, bestMove: m[1] }));
      }
    };

    engine.postMessage('uci');
    engine.postMessage('ucinewgame');
    engine.postMessage('isready');

    return () => {
      engine.postMessage('quit');
      engine.terminate();
    };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engineRef.current) return;
    engineRef.current.postMessage('stop');
    engineRef.current.postMessage(`position fen ${fen}`);
    engineRef.current.postMessage('go depth 20');
    setSfInfo(p => ({ ...p, bestMove: null, depth: 0 }));
  }, []);

  return { sfInfo, analyse };
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatEval(sfInfo, isWhiteTurn) {
  if (!sfInfo || !sfInfo.ready) return '…';
  if (sfInfo.type === 'mate') {
    const m = isWhiteTurn ? sfInfo.score : -sfInfo.score;
    return m > 0 ? `#${m}` : `-#${Math.abs(m)}`;
  }
  const v = isWhiteTurn ? sfInfo.score : -sfInfo.score;
  return v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
}

function evalToWhitePct(sfInfo, isWhiteTurn) {
  if (!sfInfo) return 50;
  let v;
  if (sfInfo.type === 'mate') {
    const m = isWhiteTurn ? sfInfo.score : -sfInfo.score;
    v = m > 0 ? 10 : -10;
  } else {
    v = isWhiteTurn ? sfInfo.score : -sfInfo.score;
  }
  const clamped = Math.max(-6, Math.min(6, v));
  return Math.round((clamped + 6) / 12 * 100);
}

function evalColor(v) {
  if (v > 0.5) return '#27ae60';
  if (v < -0.5) return '#e74c3c';
  return '#f39c12';
}

function WinBar({ wins, draws, losses }) {
  const total = wins + draws + losses || 1;
  const wp = Math.round(wins / total * 100);
  const dp = Math.round(draws / total * 100);
  return (
    <div className="win-bar">
      <div className="win-bar-w" style={{ width: `${wp}%` }} />
      <div className="win-bar-d" style={{ width: `${dp}%` }} />
      <div className="win-bar-l" style={{ width: `${100 - wp - dp}%` }} />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function InteractiveCoach({ username, preferences, color, onReset }) {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [mentorData, setMentorData] = useState(null);
  const [yourGames, setYourGames] = useState(null);
  const [mentorLoading, setMentorLoading] = useState(false);

  const { sfInfo, analyse } = useStockfish();

  const topStyles = Object.entries(preferences || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => STYLE_LABELS[k] || k);

  const isWhiteTurn = game.turn() === 'w';
  const isUserTurn  = color === 'white' ? isWhiteTurn : !isWhiteTurn;

  // ── Fetch coach data + your-games whenever board changes ──
  const fetchAll = useCallback(async (g) => {
    const history = g.history();
    const fen = g.fen();

    analyse(fen);   // kick off Stockfish analysis

    setMentorLoading(true);
    try {
      const [mentorRes, gamesRes] = await Promise.all([
        axios.post(`${API_BASE}/coach/lines`, { moves: history, color }),
        axios.get(`${API_BASE}/explorer/moves`, { params: { fen } }),
      ]);
      setMentorData(mentorRes.data);
      setYourGames(gamesRes.data);
    } catch (err) {
      console.error('Fetch error', err);
    } finally {
      setMentorLoading(false);
    }
  }, [color, analyse]);

  useEffect(() => { fetchAll(game); }, [game, fetchAll]);

  // ── Move execution ──
  const applyMove = useCallback((from, to, san) => {
    const copy = new Chess(game.fen());
    try {
      const move = san ? copy.move(san) : copy.move({ from, to, promotion: 'q' });
      if (move) { setGame(copy); setSelectedSquare(null); return true; }
    } catch {}
    return false;
  }, [game]);

  const handleSquareClick = useCallback((square) => {
    const piece = game.get(square);
    if (!selectedSquare) {
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
      return;
    }
    if (square === selectedSquare) { setSelectedSquare(null); return; }
    if (applyMove(selectedSquare, square)) return;
    if (piece && piece.color === game.turn()) setSelectedSquare(square);
    else setSelectedSquare(null);
  }, [game, selectedSquare, applyMove]);

  const onPieceDrop  = (src, tgt) => applyMove(src, tgt);
  const playMove     = (san) => applyMove(null, null, san);
  const handleUndo   = () => { const c = new Chess(game.fen()); c.undo(); setGame(c); setSelectedSquare(null); };
  const resetBoard   = () => { setGame(new Chess()); setSelectedSquare(null); };

  // ── Eval bar ──
  const whitePct  = evalToWhitePct(sfInfo, isWhiteTurn);
  const evalLabel = formatEval(sfInfo, isWhiteTurn);
  const evalVal   = sfInfo?.type === 'cp' ? (isWhiteTurn ? sfInfo.score : -sfInfo.score) : 0;

  const history = game.history();
  const customSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255,215,0,0.55)', borderRadius: '4px' } }
    : {};

  return (
    <div className="coach-root">

      {/* ── LEFT: AI Mentor ── */}
      <div className="mentor-panel panel">
        <div className="panel-header">
          <span className="panel-icon">♟</span>
          <h3>AI Chess Second</h3>
        </div>

        {topStyles.length > 0 && (
          <div className="target-row">
            <span className="target-label">Your targets:</span>
            {topStyles.map(s => <span key={s} className="style-chip">{s}</span>)}
          </div>
        )}

        {/* Stockfish best move hint */}
        {sfInfo.ready && sfInfo.bestMove && (
          <div className="sf-hint">
            <span className="sf-label">Engine suggests</span>
            <button className="sf-move-btn" onClick={() => {
              // Convert UCI move (e2e4) to SAN
              const copy = new Chess(game.fen());
              try {
                const from = sfInfo.bestMove.slice(0, 2);
                const to   = sfInfo.bestMove.slice(2, 4);
                const promo = sfInfo.bestMove[4] || 'q';
                copy.move({ from, to, promotion: promo });
                playMove(copy.history().slice(-1)[0]);
              } catch {}
            }}>
              {sfInfo.bestMove}
            </button>
            <span className="sf-depth">d{sfInfo.depth}</span>
          </div>
        )}

        <div className="mentor-body">
          {mentorLoading ? (
            <p className="hint-text">Analyzing…</p>
          ) : mentorData ? (
            isUserTurn ? (
              <>
                <h4 className="section-title">Your best lines ({color})</h4>
                {mentorData.lines?.length > 0 ? (
                  <div className="lines-list">
                    {mentorData.lines.map((line, i) => (
                      <div key={i} className="line-card">
                        <div className="line-moves-row">
                          {line.moves.map((m, mi) => (
                            <button
                              key={mi}
                              className={`line-move-btn ${mi % 2 === 0 ? 'white-move' : 'black-move'}`}
                              onClick={() => playMove(m)}
                              title="Click to play"
                            >{m}</button>
                          ))}
                        </div>
                        <div className="line-info">
                          <span className="line-type-badge">{STYLE_LABELS[line.target_type] || line.target_type}</span>
                          <span className="line-stats">
                            {line.games_played > 0
                              ? `${line.win_rate} wins · ${line.games_played} games`
                              : `${line.structure_win_rate} in this structure`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint-text">No data yet — explore freely!</p>
                )}
              </>
            ) : (
              <>
                <h4 className="section-title">Black's common replies</h4>
                <p className="hint-text">From your game history — click to play</p>
                {mentorData.opponent_moves?.length > 0 ? (
                  <ul className="opp-list">
                    {mentorData.opponent_moves.map((m, i) => (
                      <li key={i} className="opp-item" onClick={() => playMove(m.san)}>
                        <span className="opp-san">{m.san}</span>
                        <WinBar wins={m.wins} draws={m.draws} losses={m.losses} />
                        <div className="opp-meta">
                          <span>{m.games} games</span>
                          <span className={parseInt(m.user_win_rate) >= 50 ? 'good' : 'bad'}>
                            You win {m.user_win_rate}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint-text">No opponent data here yet.</p>
                )}
              </>
            )
          ) : (
            <p className="hint-text">Make a move to start coaching.</p>
          )}
        </div>
      </div>

      {/* ── CENTER: Board ── */}
      <div className="board-section">
        <h2 className="board-title">Interactive Coaching Board</h2>

        <div className="board-with-eval">
          {/* Vertical Stockfish eval bar */}
          <div className="eval-wrap">
            <span className="eval-num" style={{ color: evalColor(evalVal) }}>{evalLabel}</span>
            <div className="eval-bar">
              <div className="eval-black-part" style={{ height: `${100 - whitePct}%` }} />
              <div className="eval-white-part" style={{ height: `${whitePct}%` }} />
            </div>
            <span className="eval-depth">d{sfInfo.depth}</span>
          </div>

          <Chessboard
            position={game.fen()}
            onPieceDrop={onPieceDrop}
            onSquareClick={handleSquareClick}
            boardOrientation={color || 'white'}
            boardWidth={400}
            customSquareStyles={customSquareStyles}
            animationDuration={150}
          />
        </div>

        {/* Move history */}
        <div className="move-history">
          {history.length === 0
            ? <span className="hint-text">No moves yet</span>
            : history.map((m, i) => (
                <span key={i} className="hist-move">
                  {i % 2 === 0 && <span className="hist-num">{Math.floor(i / 2) + 1}.</span>}
                  {m}
                </span>
              ))}
        </div>

        <div className="board-actions">
          <button className="btn-secondary" onClick={handleUndo} disabled={history.length === 0}>↩ Undo</button>
          <button className="btn-secondary" onClick={resetBoard}>Reset Board</button>
          <button className="btn-danger" onClick={onReset}>Start Over</button>
        </div>
      </div>

      {/* ── RIGHT: Your Games ── */}
      <div className="your-games-panel panel">
        <div className="panel-header">
          <span className="panel-icon">📊</span>
          <h3>Your Games Here</h3>
        </div>
        <p className="hint-text">Moves you've played — click to play on board</p>

        {yourGames?.moves?.length > 0 ? (
          <ul className="your-list">
            {yourGames.moves.slice(0, 8).map(m => {
              const total = (m.white || 0) + (m.draws || 0) + (m.black || 0);
              const wins  = color === 'white' ? (m.white || 0) : (m.black || 0);
              const draws = m.draws || 0;
              const losses = total - wins - draws;
              const winPct = total > 0 ? Math.round(wins / total * 100) : 0;
              return (
                <li key={m.san} className="your-item" onClick={() => playMove(m.san)}>
                  <div className="your-item-top">
                    <span className="your-san">{m.san}</span>
                    <span className="your-count">{total}×</span>
                    <span className={`your-pct ${winPct >= 50 ? 'good' : 'bad'}`}>{winPct}%</span>
                  </div>
                  <WinBar wins={wins} draws={draws} losses={losses} />
                  <div className="your-item-bottom">
                    <span className="win">{wins}W</span>
                    <span className="draw"> · {draws}D</span>
                    <span className="loss"> · {losses}L</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="no-data-box">
            <p>{yourGames === null ? 'Loading…' : "You haven't played from this position."}</p>
          </div>
        )}
      </div>

    </div>
  );
}
