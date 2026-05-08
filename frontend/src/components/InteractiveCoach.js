import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import './InteractiveCoach.css';

const API_BASE = 'http://localhost:8000';

function InteractiveCoach({ username, preferences, color, onReset }) {
  const [game, setGame] = useState(new Chess());
  const [coachData, setCoachData] = useState(null);
  const [explorerData, setExplorerData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCoachData(game.history());
    fetchExplorerData(game.fen());
  }, [game.fen()]);

  const fetchCoachData = async (moves) => {
    try {
      setLoading(true);
      const res = await axios.post(`${API_BASE}/coach/position`, { moves });
      setCoachData(res.data);
    } catch (err) {
      console.error('Error fetching coach data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExplorerData = async (fen) => {
    try {
      // Use Lichess public explorer
      const res = await axios.get(`https://explorer.lichess.ovh/masters?fen=${encodeURIComponent(fen)}`);
      setExplorerData(res.data);
    } catch (err) {
      console.error('Error fetching explorer', err);
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });
      if (move === null) return false;
      setGame(gameCopy);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleExplorerMove = (san) => {
    const gameCopy = new Chess(game.fen());
    gameCopy.move(san);
    setGame(gameCopy);
  };

  return (
    <div className="coach-container">
      <div className="board-section">
        <h2>Interactive Coaching Engine</h2>
        <p>Make a move. The opponent's response can be chosen from the Explorer.</p>
        <div style={{ width: '400px', margin: '0 auto' }}>
          <Chessboard position={game.fen()} onPieceDrop={onDrop} boardOrientation={color} />
        </div>
        <button className="reset-btn" onClick={onReset}>Start Over</button>
      </div>
      
      <div className="sidebar-section">
        <div className="coach-panel">
          <h3>♟ AI Chess Second</h3>
          {loading ? (
            <p>Analyzing...</p>
          ) : coachData ? (
            <div>
              <p>You have reached this position <strong>{coachData.total_games}</strong> times.</p>
              <p className="record">
                Record: <span className="win">{coachData.wins} W</span> - <span className="draw">{coachData.draws} D</span> - <span className="loss">{coachData.losses} L</span>
              </p>
              
              <h4>Coaching Advice:</h4>
              {coachData.recommended_moves?.length > 0 ? (
                <ul className="recommendations">
                  {coachData.recommended_moves.map((rec, i) => (
                    <li key={i}>
                      Try <strong>{rec.move}</strong> - steers the game toward your preferred <em>{rec.style}</em> structures!
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No particular positional data leads straight to your strengths here. Play flexibly!</p>
              )}
            </div>
          ) : (
             <p>No data</p>
          )}
        </div>

        <div className="explorer-panel">
          <h3>Master Explorer Moves</h3>
          {explorerData && explorerData.moves?.length > 0 ? (
            <ul className="explorer-moves">
              {explorerData.moves.slice(0, 5).map(m => (
                <li key={m.san} onClick={() => handleExplorerMove(m.san)}>
                  <strong>{m.san}</strong> ({(m.white + m.draws + m.black)} games)
                </li>
              ))}
            </ul>
          ) : (
            <p>No explorer data</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default InteractiveCoach;