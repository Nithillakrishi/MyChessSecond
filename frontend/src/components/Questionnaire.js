import React, { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import './Questionnaire.css';

// Correct, distinctive FEN for each position type
const POSITION_FENS = {
  // King's Indian Attack: white bishop fianchettoed on g2 (clearly visible), g3 pawn, castled
  Fianchetto:
    'r1bq1rk1/pp2bppp/2n1pn2/2pp4/4P3/3P1NP1/PPPN1PBP/R1BQ1RK1 b - - 0 9',
  // Scotch Opening: white controls center with BOTH e4 and d4 pawns at the same time
  CentralControl:
    'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3',
  // f4+e4 pawn storm + Bc4: classic kingside attacking formation
  KingsideAttack:
    'r1bq1rk1/ppp2ppp/2np1n2/4p3/2B1PP2/2NP1N2/PPP3PP/R1BQR1K1 b - - 0 9',
  // White pushes a4+b4 — minority attack marching up the queenside
  QueensideAttack:
    'r1bq1rk1/ppp2ppp/2np1n2/8/PP2P3/2NP1N2/2B2PPP/R1BQR1K1 b - - 0 11',
  // King's Indian locked center: d5 vs e5 pawn wall, no open files, piece maneuver
  ClosedPositional:
    'r1bq1rk1/ppp2pbp/2np1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQR1K1 b - - 0 9',
  // Sicilian Yugoslav attack: Bg5 vs Dragon bishop — sharpest setup in chess
  SharpTactical:
    'r2q1rk1/pp1bppbp/2np1np1/6B1/3NP3/2N2B2/PPP2PPP/R2QR1K1 b - - 4 12',
  // IQP: isolated d-pawn, lots of pieces still on board, long strategic fight ahead
  LongMiddlegame:
    'r1b1qrk1/pp3ppp/2nbpn2/3p4/3P4/2N1PN2/PP2BPPP/R1BQR1K1 b - - 0 12',
  // Pure king and pawn endgame — all heavy pieces gone, kings march to center
  EndgameApproaching:
    '4k3/ppp2ppp/3p4/8/3P4/8/PPP2PPP/4K3 w - - 0 1',
  // Balanced Ruy Lopez type — general mixed middlegame
  Mixed:
    'r1bq1rk1/ppp2ppp/2np1n2/4p3/4P3/2NP1N2/PPP1BPPP/R1BQR1K1 b - - 0 8',
  // Open Game: Italian Game or Two Knights Defense - open lines, rapid development
  OpenGame:
    'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5',
  // Closed Game: Caro-Kann or French Defense - solid pawn structure, maneuvering
  ClosedGame:
    'rnbqkb1r/pp1ppppp/2p2n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4',
  // Passed Pawn: Advanced passed pawn creating winning chances
  PassedPawn:
    '6k1/6pp/8/6P1/8/8/6K1/8 w - - 0 1',
  // Weak King: Exposed king with vulnerable pawn shelter
  WeakKing:
    'r1bq1rk1/pppp1ppp/2n2n2/4p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQ - 0 8',
  // Rook Endgame: Rook and pawns vs rook and pawns
  RookEndgame:
    '6k1/5ppp/8/8/3r4/3R1P2/5KPP/8 w - - 0 1',
  // Open Files: Rooks on open files with attacking chances
  OpenFiles:
    'r1b1qrk1/pp3ppp/2n1bn2/3pp3/2BPP3/2N2N2/PPP2PPP/R1BQR1K1 w - - 0 9',
  // Isolated Pawn: Weak isolated central pawn creating long-term weakness
  IsolatedPawn:
    'r1bq1rk1/pp3ppp/2np1n2/3P4/3p4/2N2N2/PPP1BPPP/R1BQR1K1 w - - 0 10',
  // Pawn Breakthroughs: Advanced pawn storms and breakthroughs
  PawnBreakthrough:
    'r1b1k2r/ppq2ppp/2n1pn2/3p4/2PP4/2N2N2/PP1QBPPP/R3K2R w KQkq - 0 9',
};

const TYPE_LABELS = {
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

function PositionCard({ posType, winRate, label, onClick }) {
  const fen = POSITION_FENS[posType] || POSITION_FENS.Mixed;
  return (
    <div className="option-card" onClick={onClick}>
      <div className="option-label">{label}</div>
      <div className="option-board">
        <Chessboard
          position={fen}
          boardWidth={190}
          arePiecesDraggable={false}
          areArrowsAllowed={false}
          animationDuration={0}
        />
      </div>
      <div className="option-type">{TYPE_LABELS[posType] || posType}</div>
      <div className="stat">Your win rate: {winRate}</div>
    </div>
  );
}

function Questionnaire({ questions, onSubmit, disabled, username, positionTypes, positionTypesWithStats }) {
  const [color, setColor] = useState('white');

  // Get all position types and their stats
  const allPositionTypesWithStats = positionTypesWithStats || [];

  const handleSubmit = (e) => {
    e.preventDefault();
    // Create preferences based on all position types - default to 3 (neutral) for all
    const preferences = {};
    allPositionTypesWithStats.forEach(item => {
      preferences[item.position_type] = 3; // Default neutral preference
    });
    onSubmit({ username, preferences, color });
  };

  return (
    <div className="questionnaire-card">
      <h2>Your Position Type Win Rates</h2>
      <p className="hint-text">Here are your win rates across different position types from your game history</p>

      <div className="win-rate-grid">
        {allPositionTypesWithStats.map(item => (
          <div key={item.position_type} className="win-rate-card">
            <div className="position-preview">
              <Chessboard
                position={POSITION_FENS[item.position_type] || POSITION_FENS.Mixed}
                boardWidth={140}
                arePiecesDraggable={false}
                areArrowsAllowed={false}
                animationDuration={0}
              />
            </div>
            <div className="position-name">{TYPE_LABELS[item.position_type] || item.position_type}</div>
            <div className="win-rate-display">
              <div className="win-rate-percentage">{item.win_rate}</div>
              <div className="win-rate-details">
                {item.wins}W - {item.losses}L - {item.draws}D ({item.total_games} games)
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="preferences-form">
        <div className="form-group">
          <label>Color you want to play:</label>
          <select value={color} onChange={e => setColor(e.target.value)} disabled={disabled}>
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </div>
        <button type="submit" className="submit-btn" disabled={disabled}>
          Enter Interactive Coach
        </button>
      </form>
    </div>
  );
}

export default Questionnaire;
