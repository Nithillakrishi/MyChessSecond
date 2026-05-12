import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpeningFromGame } from '../utils/openingDetector';
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
  OpenGame: 'Open Game',
  ClosedGame: 'Closed Game',
  PassedPawn: 'Passed Pawn',
  WeakKing: 'Weak King',
  RookEndgame: 'Rook Endgame',
  OpenFiles: 'Open Files',
  IsolatedPawn: 'Isolated Pawn',
  PawnBreakthrough: 'Pawn Breakthrough',
};

// ── Single-PV Stockfish hook (stable, captures full PV) ───────────────────
function useStockfish() {
  const engineRef = useRef(null);
  const [sfInfo, setSfInfo] = useState({
    score: 0, type: 'cp', depth: 0, bestMove: null, ready: false, pv: [],
  });

  useEffect(() => {
    try {
      const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
      engineRef.current = engine;
      engine.onerror = (err) => console.error('Stockfish worker error:', err);

      engine.onmessage = (e) => {
        try {
          const line = typeof e.data === 'string' ? e.data : String(e.data);
          if (line === 'readyok') { setSfInfo(p => ({ ...p, ready: true })); return; }

          if (line.startsWith('info') && line.includes('score')) {
            const cpMatch    = line.match(/score cp (-?\d+)/);
            const mateMatch  = line.match(/score mate (-?\d+)/);
            const depthMatch = line.match(/\bdepth (\d+)/);
            const pvIdx      = line.indexOf(' pv ');
            const depth      = depthMatch ? parseInt(depthMatch[1]) : 0;
            const pv         = pvIdx >= 0 ? line.slice(pvIdx + 4).trim().split(' ') : [];
            if (mateMatch) {
              setSfInfo(p => ({ ...p, score: parseInt(mateMatch[1]), type: 'mate', depth, pv }));
            } else if (cpMatch) {
              setSfInfo(p => ({ ...p, score: parseInt(cpMatch[1]) / 100, type: 'cp', depth, pv }));
            }
          }

          if (line.startsWith('bestmove')) {
            const m = line.match(/bestmove (\S+)/);
            if (m && m[1] !== '(none)') setSfInfo(p => ({ ...p, bestMove: m[1] }));
          }
        } catch (err) { console.error('Stockfish message error:', err); }
      };

      engine.postMessage('uci');
      engine.postMessage('ucinewgame');
      engine.postMessage('isready');
      return () => { try { engine.postMessage('quit'); engine.terminate(); } catch {} };
    } catch (err) { console.error('Stockfish init error:', err); return () => {}; }
  }, []);

  const analyse = useCallback((fen) => {
    if (!engineRef.current || !fen) return;
    try {
      engineRef.current.postMessage('stop');
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage('go depth 20');
      setSfInfo(p => ({ ...p, bestMove: null, depth: 0, pv: [] }));
    } catch (err) { console.error('Stockfish analyse error:', err); }
  }, []);

  return { sfInfo, analyse };
}

// ── Convert UCI pv to SAN sequence ───────────────────────────────────────
function uciToSanLine(fen, uciMoves, maxMoves = 10) {
  try {
    const g = new Chess(fen);
    const result = [];
    for (const uci of uciMoves.slice(0, maxMoves)) {
      const m = g.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || 'q' });
      if (!m) break;
      result.push({ san: m.san, color: m.color });
    }
    return result;
  } catch { return []; }
}

// ── Best-line panel (single engine line) ──────────────────────────────────
function EngineLine({ sfInfo, fen, isWhiteTurn }) {
  const { score, type, depth, pv, ready } = sfInfo;

  // Adjust score to be from white's perspective
  const adjustedScore = isWhiteTurn ? score : -score;

  const evalDisplay = !ready ? '—'
    : type === 'mate'
      ? (adjustedScore > 0 ? `M${Math.abs(score)}` : `-M${Math.abs(score)}`)
      : (adjustedScore >= 0 ? `+${adjustedScore.toFixed(2)}` : adjustedScore.toFixed(2));

  const evalPos = !ready ? 'neutral'
    : adjustedScore > 0.3 ? 'white'
    : adjustedScore < -0.3 ? 'black'
    : 'neutral';

  const sanLine = ready && pv.length > 0 ? uciToSanLine(fen, pv, 10) : [];

  let startMoveNum = 1;
  try { startMoveNum = new Chess(fen).moveNumber(); } catch {}
  const startsBlack = !isWhiteTurn;

  const tokens = [];
  sanLine.forEach((mv, i) => {
    const isWm = mv.color === 'w';
    if (isWm || (i === 0 && startsBlack)) {
      const num = startMoveNum + Math.floor((i + (startsBlack ? 1 : 0)) / 2);
      tokens.push({ type: 'num', text: isWm ? `${num}.` : `${num}…`, key: `n${i}` });
    }
    tokens.push({ type: 'move', text: mv.san, key: `m${i}` });
  });

  return (
    <div className="coach-pv-list">
      <div className={`coach-pv-row ${!ready || pv.length === 0 ? 'coach-pv-loading' : ''}`}>
        <span className="coach-pv-num">1</span>
        <span className={`coach-pv-eval coach-pv-eval-${evalPos}`}>{evalDisplay}</span>
        <span className="coach-pv-moves">
          {!ready || pv.length === 0
            ? <span className="coach-pv-movenum">analysing…</span>
            : tokens.map(t => t.type === 'num'
                ? <span key={t.key} className="coach-pv-movenum">{t.text} </span>
                : <span key={t.key} className="coach-pv-movesym">{t.text} </span>
              )
          }
        </span>
      </div>
      {depth > 0 && (
        <div className="coach-sf-depth">depth {depth} · Stockfish 18</div>
      )}
    </div>
  );
}

// ── Win bar ───────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────
export default function InteractiveCoach({ username, preferences, color, onReset }) {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [mentorData, setMentorData] = useState(null);
  const [mentorLoading, setMentorLoading] = useState(false);

  const { sfInfo, analyse } = useStockfish();

  const topStyles = Object.entries(preferences || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k]) => STYLE_LABELS[k] || k);

  const isWhiteTurn = game.turn() === 'w';
  const isUserTurn  = color === 'white' ? isWhiteTurn : !isWhiteTurn;

  // Fetch coach data whenever board changes
  const fetchMentor = useCallback(async (g) => {
    const fen = g.fen();
    analyse(fen);
    setMentorLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/coach/lines`, { moves: g.history(), color });
      setMentorData(res.data);
    } catch (err) {
      console.error('Coach lines error:', err.response?.data || err.message);
      setMentorData(null);
    } finally {
      setMentorLoading(false);
    }
  }, [color, analyse]);

  useEffect(() => { fetchMentor(game); }, [game, fetchMentor]);

  // Move execution
  const applyMove = useCallback((from, to, san) => {
    try {
      const copy = new Chess(game.fen());
      let move;
      if (san)       move = copy.move(san);
      else if (from) move = copy.move({ from, to, promotion: 'q' });
      if (move) { setGame(copy); setSelectedSquare(null); return true; }
    } catch (err) { console.error('Move error:', err.message); }
    return false;
  }, [game]);

  const handleSquareClick = useCallback((sq) => {
    const piece = game.get(sq);
    if (!selectedSquare) {
      if (piece && piece.color === game.turn()) setSelectedSquare(sq);
      return;
    }
    if (sq === selectedSquare) { setSelectedSquare(null); return; }
    if (applyMove(selectedSquare, sq)) return;
    if (piece && piece.color === game.turn()) setSelectedSquare(sq);
    else setSelectedSquare(null);
  }, [game, selectedSquare, applyMove]);

  const onPieceDrop = (src, tgt) => applyMove(src, tgt);
  const playMove    = (san) => applyMove(null, null, san);
  const handleUndo  = () => { const c = new Chess(game.fen()); c.undo(); setGame(c); setSelectedSquare(null); };
  const resetBoard  = () => { setGame(new Chess()); setSelectedSquare(null); };

  // Eval bar — Stockfish score is always from side-to-move's perspective
  const adjustedScore = isWhiteTurn ? sfInfo.score : -sfInfo.score;
  const whitePct = Math.min(90, Math.max(10, 50 + adjustedScore * 4));
  const evalLabel = sfInfo.ready
    ? (adjustedScore >= 0 ? `+${adjustedScore.toFixed(1)}` : adjustedScore.toFixed(1))
    : '…';

  // Best move in SAN for the hint button
  let bestMoveSan = sfInfo.bestMove;
  if (sfInfo.bestMove && sfInfo.ready) {
    try {
      const tmp = new Chess(game.fen());
      const r = tmp.move({ from: sfInfo.bestMove.slice(0,2), to: sfInfo.bestMove.slice(2,4), promotion: sfInfo.bestMove[4] || 'q' });
      if (r) bestMoveSan = r.san;
    } catch {}
  }

  const history = game.history();
  const customSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255,215,0,0.55)', borderRadius: '4px' } }
    : {};

  return (
    <div className="coach-outer">
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

        {sfInfo.ready && bestMoveSan && (
          <div className="sf-hint">
            <span className="sf-label">Best move</span>
            <button className="sf-move-btn" onClick={() => playMove(bestMoveSan)}>
              {bestMoveSan}
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
                            <button key={mi}
                              className={`line-move-btn ${mi % 2 === 0 ? 'white-move' : 'black-move'}`}
                              onClick={() => playMove(m)}
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
                <h4 className="section-title">Common replies</h4>
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
          <div className="eval-wrap">
            <span className="eval-num">{evalLabel}</span>
            <div className="eval-bar">
              <div className="eval-black-part" style={{ height: `${100 - whitePct}%` }} />
              <div className="eval-white-part" style={{ height: `${whitePct}%` }} />
            </div>
          </div>

          <Chessboard
            position={game.fen()}
            onPieceDrop={onPieceDrop}
            onSquareClick={handleSquareClick}
            boardOrientation={color || 'white'}
            boardWidth={400}
            customSquareStyles={customSquareStyles}
            customDarkSquareStyle={{ backgroundColor: boardDark }}
            customLightSquareStyle={{ backgroundColor: boardLight }}
            animationDuration={150}
          />
        </div>

        <OpeningBadge opening={detectOpeningFromGame(game)} />

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

      {/* ── RIGHT: Engine best line ── */}
      <div className="right-column">
        <div className="coach-sf-panel panel">
          <div className="panel-header">
            <span className="panel-icon">⚡</span>
            <h3>Engine Best Line</h3>
          </div>
          <div className="coach-turn-lbl">
            {isWhiteTurn ? 'White to move' : 'Black to move'}
            {!sfInfo.ready && <span className="coach-sf-loading"> · loading…</span>}
          </div>
          <EngineLine sfInfo={sfInfo} fen={game.fen()} isWhiteTurn={isWhiteTurn} />
        </div>
      </div>

    </div>
    </div>
  );
}
