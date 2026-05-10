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

function Questionnaire({ questions, onSubmit, disabled, username }) {
  const [answers, setAnswers] = useState({});
  const [color, setColor] = useState('white');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const handleSelect = (selectedPosType) => {
    setAnswers(prev => ({
      ...prev,
      [selectedPosType]: (prev[selectedPosType] || 0) + 5
    }));
    setCurrentQuestionIndex(curr => curr + 1);
  };

  const isFinished = currentQuestionIndex >= questions.length;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ username, preferences: answers, color });
  };

  if (isFinished) {
    return (
      <div className="questionnaire-card final-step">
        <h2>Your Preferences are Set!</h2>
        <p>You're ready to start interactive coaching.</p>
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

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="questionnaire-card">
      <div className="progress">
        Question {currentQuestionIndex + 1} of {questions.length}
      </div>
      <h2>Which position would you rather play?</h2>
      <p className="hint-text">Click the board you prefer</p>

      <div className="options-container">
        <PositionCard
          posType={currentQ.position_type_1}
          winRate={currentQ.your_win_rate_1}
          label="Option A"
          onClick={() => handleSelect(currentQ.position_type_1)}
        />

        <div className="option-divider">OR</div>

        <PositionCard
          posType={currentQ.position_type_2}
          winRate={currentQ.your_win_rate_2}
          label="Option B"
          onClick={() => handleSelect(currentQ.position_type_2)}
        />
      </div>
    </div>
  );
}

export default Questionnaire;
