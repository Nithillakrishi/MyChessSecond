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
  Mixed: 'Mixed / Flexible',
};

function InteractiveCoach({ username, preferences, color, onReset }) {
  const [game, setGame] = useState(new Chess());
  const [coachData, setCoachData] = useState(null);
  const [explorerData, setExplorerData] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [moveHistory, setMoveHistory] = useState([]);

  // Derive the top preferred styles from preferences prop for display
  const topStyles = Object.entries(preferences || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => STYLE_LABELS[k] || k);

  const fetchCoachData = useCallback(async (history) => {
    try {
      setCoachLoading(true);
      const res = await axios.post(`${API_BASE}/coach/position`, { moves: history });
      setCoachData(res.data);
    } catch (err) {
      console.error('Coach data error', err);
    } finally {
      setCoachLoading(false);
    }
  }, []);

  const fetchExplorerData = useCallback(async (fen) => {
    try {
      const res = await axios.get(`${API_BASE}/explorer/moves`, { params: { fen } });
      setExplorerData(res.data);
    } catch (err) {
      console.error('Explorer error', err);
    }
  }, []);

  useEffect(() => {
    const history = game.history();
    setMoveHistory(history);
    fetchCoachData(history);
    fetchExplorerData(game.fen());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const onDrop = (sourceSquare, targetSquare) => {
    const copy = new Chess(game.fen());
    try {
      const move = copy.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) return false;
      setGame(copy);
      return true;
    } catch {
      return false;
    }
  };

  const handleExplorerMove = (san) => {
    const copy = new Chess(game.fen());
    try {
      copy.move(san);
      setGame(copy);
    } catch {
      // ignore illegal
    }
  };

  const handleUndo = () => {
    const copy = new Chess(game.fen());
    copy.undo();
    setGame(copy);
  };

  const handleReset = () => {
    setGame(new Chess());
    setCoachData(null);
    setExplorerData(null);
  };

  const currentType = coachData?.current_position_type;
  const isStrength = currentType && preferences && (preferences[currentType] || 0) >= 4;

  return (
    <div className="coach-container">
      <div className="board-section">
        <h2>Interactive Coaching Engine</h2>
        <p className="board-hint">Make a move. The coach will steer you toward your winning middlegames.</p>

        {topStyles.length > 0 && (
          <p className="style-targets">
            Your targets: {topStyles.map(s => <span key={s} className="style-chip">{s}</span>)}
          </p>
        )}

        <div style={{ width: '420px', margin: '0 auto' }}>
          <Chessboard
            position={game.fen()}
            onPieceDrop={onDrop}
            boardOrientation={color || 'white'}
            boardWidth={420}
          />
        </div>

        {moveHistory.length > 0 && (
          <div className="move-history">
            {moveHistory.map((m, i) => (
              <span key={i} className="move-chip">
                {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{m}
              </span>
            ))}
          </div>
        )}

        <div className="board-actions">
          <button className="btn-secondary" onClick={handleUndo} disabled={moveHistory.length === 0}>
            Undo
          </button>
          <button className="btn-secondary" onClick={handleReset}>
            Reset Board
          </button>
          <button className="btn-danger" onClick={onReset}>
            Start Over
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="coach-panel">
          <h3>♟ AI Chess Second</h3>

          {coachLoading ? (
            <p className="analyzing">Analyzing position...</p>
          ) : coachData ? (
            <>
              {currentType && (
                <div className={`position-badge ${isStrength ? 'strength' : 'neutral'}`}>
                  <span className="badge-label">Current structure</span>
                  <span className="badge-type">{STYLE_LABELS[currentType] || currentType}</span>
                  {isStrength && <span className="badge-star">⭐ Your strength!</span>}
                </div>
              )}

              {coachData.total_games > 0 && (
                <p className="record">
                  Your results in <em>{STYLE_LABELS[currentType]}</em> positions:{' '}
                  <span className="win">{coachData.wins}W</span>{' · '}
                  <span className="draw">{coachData.draws}D</span>{' · '}
                  <span className="loss">{coachData.losses}L</span>
                  {' '}
                  <span className="win-pct">
                    ({coachData.total_games > 0
                      ? `${Math.round(coachData.wins / coachData.total_games * 100)}% wins`
                      : '—'})
                  </span>
                </p>
              )}

              <h4>Coaching Advice</h4>
              {coachData.recommended_moves?.length > 0 ? (
                <ul className="recommendations">
                  {coachData.recommended_moves.map((rec, i) => (
                    <li key={i} className="rec-item">
                      <span className="rec-move">{rec.move}</span>
                      <span className="rec-arrow">→</span>
                      <span className="rec-detail">
                        steers to <strong>{STYLE_LABELS[rec.style] || rec.style}</strong>
                        {rec.total_games_in_type > 0
                          ? ` · ${rec.win_rate} wins across ${rec.total_games_in_type} games`
                          : ''}
                        {rec.times_you_played > 0
                          ? ` · you've played this ${rec.times_you_played}×`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-recs">
                  {moveHistory.length === 0
                    ? 'Make your first move to get personalized coaching.'
                    : 'No moves here lead directly to your preferred structures. Play flexibly and keep pieces active.'}
                </p>
              )}
            </>
          ) : (
            <p>Make a move to start coaching.</p>
          )}
        </div>

        <div className="explorer-panel">
          <h3>Your Moves Here</h3>
          <p className="explorer-hint">Moves you've played from this position</p>
          {explorerData?.moves?.length > 0 ? (
            <ul className="explorer-moves">
              {explorerData.moves.slice(0, 6).map(m => {
                const total = (m.white || 0) + (m.draws || 0) + (m.black || 0);
                const winPct = total > 0 ? Math.round(m.white / total * 100) : 0;
                return (
                  <li key={m.san} onClick={() => handleExplorerMove(m.san)} className="explorer-move">
                    <strong className="exp-san">{m.san}</strong>
                    <span className="exp-games">{total}×</span>
                    <span className="exp-bar">
                      <span className="exp-white" style={{ width: `${winPct}%` }} />
                    </span>
                    <span className="exp-pct">{winPct}% wins</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="no-explorer">
              {explorerData === null
                ? 'Loading...'
                : 'You haven\'t played from this position in your game history.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default InteractiveCoach;
