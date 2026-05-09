import React, { useState, useEffect, useCallback } from 'react';
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

const PIECE_VALUES = { p: 1, n: 3, b: 3.5, r: 5, q: 9 };

function materialEval(g) {
  let white = 0, black = 0;
  g.board().forEach(row =>
    row.forEach(piece => {
      if (piece && piece.type !== 'k') {
        const v = PIECE_VALUES[piece.type] || 0;
        if (piece.color === 'w') white += v; else black += v;
      }
    })
  );
  return white - black;
}

function WinBar({ wins, draws, losses }) {
  const total = wins + draws + losses || 1;
  const wp = Math.round(wins / total * 100);
  const dp = Math.round(draws / total * 100);
  const lp = 100 - wp - dp;
  return (
    <div className="win-bar">
      <div className="win-bar-w" style={{ width: `${wp}%` }} />
      <div className="win-bar-d" style={{ width: `${dp}%` }} />
      <div className="win-bar-l" style={{ width: `${lp}%` }} />
    </div>
  );
}

export default function InteractiveCoach({ username, preferences, color, onReset }) {
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [mentorData, setMentorData] = useState(null);
  const [yourGames, setYourGames] = useState(null);
  const [evaluation, setEvaluation] = useState(0);
  const [mentorLoading, setMentorLoading] = useState(false);

  const topStyles = Object.entries(preferences || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => STYLE_LABELS[k] || k);

  const isWhiteTurn = game.turn() === 'w';
  const isUserTurn = color === 'white' ? isWhiteTurn : !isWhiteTurn;

  const fetchAll = useCallback(async (g) => {
    const history = g.history();
    const fen = g.fen();
    setEvaluation(materialEval(g));
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
  }, [color]);

  useEffect(() => { fetchAll(game); }, [game, fetchAll]);

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

  const onPieceDrop = (src, tgt) => applyMove(src, tgt);

  const playMove = (san) => applyMove(null, null, san);

  const handleUndo = () => {
    const copy = new Chess(game.fen());
    copy.undo();
    setGame(copy);
    setSelectedSquare(null);
  };

  const handleBoardReset = () => {
    setGame(new Chess());
    setSelectedSquare(null);
  };

  // Eval bar: clamp to ±6 pawns → 0–100%
  const evalClamped = Math.max(-6, Math.min(6, evaluation));
  const whitePct = Math.round((evalClamped + 6) / 12 * 100);
  const evalLabel = evaluation === 0 ? '0.0' : evaluation > 0 ? `+${evaluation.toFixed(1)}` : evaluation.toFixed(1);

  const history = game.history();

  const customSquareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255, 215, 0, 0.55)', borderRadius: '4px' } }
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
                            <React.Fragment key={mi}>
                              {mi > 0 && <span className="move-sep"> </span>}
                              <button
                                className={`line-move-btn ${mi % 2 === 0 ? 'white-move' : 'black-move'}`}
                                onClick={() => playMove(m)}
                                title="Click to play this move"
                              >
                                {mi % 2 === 0 && history.length % 2 === 0
                                  ? `${Math.floor((history.length + mi) / 2 + 1)}.` : ''}{m}
                              </button>
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="line-info">
                          <span className="line-type-badge">{STYLE_LABELS[line.target_type] || line.target_type}</span>
                          {line.games_played > 0
                            ? <span className="line-stats">{line.win_rate} wins · {line.games_played} games</span>
                            : <span className="line-stats">{line.structure_win_rate} in this structure</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hint-text">No data yet — you haven't played from here before. Explore freely!</p>
                )}
              </>
            ) : (
              <>
                <h4 className="section-title">Black's common replies</h4>
                <p className="hint-text">From your game history — click to play on the board</p>
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
                  <p className="hint-text">No opponent data for this position yet.</p>
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
          {/* Vertical eval bar */}
          <div className="eval-wrap">
            <span className="eval-num">{evalLabel}</span>
            <div className="eval-bar">
              <div className="eval-black-part" style={{ height: `${100 - whitePct}%` }} />
              <div className="eval-white-part" style={{ height: `${whitePct}%` }} />
            </div>
            <span className="eval-side">{evaluation > 0 ? '▲' : evaluation < 0 ? '▼' : '='}</span>
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

        {/* Move history strip */}
        <div className="move-history">
          {history.length === 0
            ? <span className="hint-text">No moves yet</span>
            : history.map((m, i) => (
                <span key={i} className="hist-move">
                  {i % 2 === 0 && <span className="hist-num">{Math.floor(i / 2) + 1}.</span>}
                  {m}
                </span>
              ))
          }
        </div>

        <div className="board-actions">
          <button className="btn-secondary" onClick={handleUndo} disabled={history.length === 0}>↩ Undo</button>
          <button className="btn-secondary" onClick={handleBoardReset}>Reset Board</button>
          <button className="btn-danger" onClick={onReset}>Start Over</button>
        </div>
      </div>

      {/* ── RIGHT: Your Games ── */}
      <div className="your-games-panel panel">
        <div className="panel-header">
          <span className="panel-icon">📊</span>
          <h3>Your Games Here</h3>
        </div>
        <p className="hint-text">Moves you've played from this position — click to play</p>

        {yourGames?.moves?.length > 0 ? (
          <ul className="your-list">
            {yourGames.moves.slice(0, 8).map(m => {
              const total = (m.white || 0) + (m.draws || 0) + (m.black || 0);
              const wins = color === 'white' ? (m.white || 0) : (m.black || 0);
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
            <p>{yourGames === null ? 'Loading…' : "You haven't played from this position before."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
