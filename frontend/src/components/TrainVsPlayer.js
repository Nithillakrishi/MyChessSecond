import React, { useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import './TrainVsPlayer.css';

const API_BASE = 'http://localhost:8000';

const SOURCES = [
  { id: 'chess.com', label: 'Chess.com' },
  { id: 'lichess', label: 'Lichess' },
];

export default function TrainVsPlayer() {
  const [phase, setPhase] = useState('search'); // search | training
  const [opponentUsername, setOpponentUsername] = useState('');
  const [source, setSource] = useState('chess.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(new Chess().fen());
  const [lastMove, setLastMove] = useState(null);
  const [opponentMoves, setOpponentMoves] = useState([]);
  const [currentOpponentMoves, setCurrentOpponentMoves] = useState([]);
  const [message, setMessage] = useState('');
  const [playerColor] = useState('white');
  const [totalGames, setTotalGames] = useState(0);

  const fetchOpponentMoves = useCallback(async (currentFen, currentGame) => {
    try {
      const res = await axios.get(`${API_BASE}/opponent-moves`, {
        params: { username: opponentUsername, source, fen: currentFen }
      });
      const moves = res.data?.moves || [];
      setCurrentOpponentMoves(moves);
      return moves;
    } catch {
      setCurrentOpponentMoves([]);
      return [];
    }
  }, [opponentUsername, source]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!opponentUsername.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/opponent-moves`, {
        params: { username: opponentUsername.trim(), source, fen: new Chess().fen() }
      });
      setTotalGames(res.data?.total_games || 0);
      setOpponentMoves(res.data?.moves || []);
      setCurrentOpponentMoves(res.data?.moves || []);
      const g = new Chess();
      setGame(g);
      setFen(g.fen());
      setLastMove(null);
      setMessage(res.data?.total_games
        ? `Loaded ${res.data.total_games} games from ${opponentUsername}. Play white and see how they respond!`
        : `No games found for ${opponentUsername} on ${source}.`);
      setPhase('training');
    } catch (err) {
      setError(err.response?.data?.detail || `Could not load games for ${opponentUsername}.`);
    } finally {
      setLoading(false);
    }
  }

  async function onDrop(from, to, piece) {
    if (game.turn() !== 'w') return false;

    const g = new Chess(game.fen());
    const move = g.move({ from, to, promotion: piece?.slice(-1)?.toLowerCase() || 'q' });
    if (!move) return false;

    setGame(g);
    setFen(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setMessage('');

    if (g.isGameOver()) {
      setMessage(g.isCheckmate() ? 'Checkmate!' : 'Game over.');
      return true;
    }

    // Play opponent's response
    setTimeout(async () => {
      const moves = await fetchOpponentMoves(g.fen(), g);
      let opponentMove = null;

      if (moves.length > 0) {
        // Weighted random from top 3 moves
        const top = moves.slice(0, 3);
        const totalFreq = top.reduce((s, m) => s + (m.total || 1), 0);
        let rand = Math.random() * totalFreq;
        for (const m of top) {
          rand -= (m.total || 1);
          if (rand <= 0) { opponentMove = m.san; break; }
        }
        if (!opponentMove) opponentMove = top[0].san;
      }

      if (opponentMove) {
        const g2 = new Chess(g.fen());
        let om;
        try {
          // Try SAN first (backend returns SAN), fall back to UCI
          om = g2.move(opponentMove);
        } catch {
          try {
            om = g2.move({ from: opponentMove.slice(0, 2), to: opponentMove.slice(2, 4), promotion: opponentMove[4] || 'q' });
          } catch { om = null; }
        }
        if (om) {
          setGame(g2);
          setFen(g2.fen());
          setLastMove({ from: om.from, to: om.to });
          const matchMove = moves.find(m => m.san === om.san);
          const favMsg = matchMove
            ? `${opponentUsername} often plays ${om.san} here (seen in ${matchMove.total} games).`
            : `${opponentUsername} played ${om.san}.`;
          setMessage(favMsg);
          if (g2.isGameOver()) setMessage(prev => prev + ' Game over.');
        }
      } else {
        setMessage(`${opponentUsername} has no data for this position. You can continue freely.`);
      }
    }, 400);

    return true;
  }

  function resetGame() {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setCurrentOpponentMoves(opponentMoves);
    setMessage(`Playing against ${opponentUsername}'s opening tendencies.`);
  }

  function backToSearch() {
    setPhase('search');
    setError('');
    setMessage('');
  }

  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(229,139,0,0.35)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(229,139,0,0.45)' };
  }

  /* ── Search phase ── */
  if (phase === 'search') {
    return (
      <div className="tvp-root">
        <div className="tvp-search-panel">
          <h2 className="tvp-title">Train vs Player Database</h2>
          <p className="tvp-sub">
            Enter any username and practice against their opening repertoire.
            We'll fetch their games and respond with their most common moves.
          </p>

          <form onSubmit={handleSearch} className="tvp-form">
            <div className="tvp-source-row">
              {SOURCES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`tvp-source-btn ${source === s.id ? 'tvp-source-active' : ''}`}
                  onClick={() => setSource(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="tvp-input-row">
              <input
                className="tvp-username-input"
                value={opponentUsername}
                onChange={e => setOpponentUsername(e.target.value)}
                placeholder="Enter username…"
                autoFocus
              />
              <button type="submit" className="tvp-search-btn" disabled={loading || !opponentUsername.trim()}>
                {loading ? 'Loading…' : 'Load Games →'}
              </button>
            </div>

            {error && <div className="tvp-error">{error}</div>}
          </form>

          <div className="tvp-how">
            <div className="tvp-how-title">How it works</div>
            <ul className="tvp-how-list">
              <li>We fetch up to 100 recent games from the opponent's profile</li>
              <li>You play as White; they respond as Black with their most common moves</li>
              <li>See which openings they prefer and find patterns in their play</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  /* ── Training phase ── */
  return (
    <div className="tvp-root">
      <div className="tvp-training-layout">
        {/* Board */}
        <div className="tvp-board-col">
          <div className="tvp-board-wrap">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={playerColor}
              customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
              customDarkSquareStyle={{ backgroundColor: '#B58863' }}
              customLightSquareStyle={{ backgroundColor: '#F0D9B5' }}
              customSquareStyles={customSquareStyles}
            />
          </div>

          {message && (
            <div className="tvp-message">{message}</div>
          )}
        </div>

        {/* Side panel */}
        <div className="tvp-side">
          <div className="tvp-opponent-card">
            <div className="tvp-opp-avatar">
              {opponentUsername[0]?.toUpperCase()}
            </div>
            <div>
              <div className="tvp-opp-name">{opponentUsername}</div>
              <div className="tvp-opp-meta">{totalGames} games · {source}</div>
            </div>
          </div>

          {currentOpponentMoves.length > 0 && (
            <div className="tvp-moves-card">
              <div className="tvp-moves-title">Their common moves here</div>
              <div className="tvp-moves-list">
                {currentOpponentMoves.slice(0, 5).map((m, i) => (
                  <div key={i} className="tvp-move-row">
                    <span className="tvp-move-rank">{i + 1}</span>
                    <span className="tvp-move-san">{m.san}</span>
                    <span className="tvp-move-freq">{m.total || '?'}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="tvp-btns">
            <button className="tvp-reset-btn" onClick={resetGame}>↺ New Game</button>
            <button className="tvp-back-btn" onClick={backToSearch}>← Change Player</button>
          </div>

          <div className="tvp-hint">
            You play as White. The opponent responds with their most common moves from their game history.
          </div>
        </div>
      </div>
    </div>
  );
}
