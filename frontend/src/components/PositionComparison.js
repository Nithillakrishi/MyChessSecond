import React, { useState } from 'react';
import './PositionComparison.css';

function PositionComparison({ positions, onSelect, onBack }) {
  const [selectedPosition, setSelectedPosition] = useState(null);

  const renderPositionInfo = (position) => {
    if (!position) return null;

    return (
      <div className="position-info">
        <div className="position-fen">
          <strong>FEN:</strong> {position.fen.substring(0, 50)}...
        </div>
        {position.evaluation && (
          <div className="position-eval">
            <strong>Evaluation:</strong>
            {position.evaluation.eval && position.evaluation.eval.value !== undefined ? (
              <span className={`eval-score ${position.evaluation.eval.value > 0 ? 'positive' : 'negative'}`}>
                {(position.evaluation.eval.value / 100).toFixed(2)}
              </span>
            ) : (
              <span>N/A</span>
            )}
          </div>
        )}
        {position.evaluation && position.evaluation.best_moves && (
          <div className="best-moves">
            <strong>Best Moves:</strong>
            {position.evaluation.best_moves.slice(0, 3).map((move, idx) => (
              <span key={idx} className="move">{move.move}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="position-comparison">
      <div className="header">
        <h2>Position Comparison</h2>
        <p>Compare these positions and choose which one feels better to you</p>
      </div>

      <div className="pairs-container">
        {positions.pairs.map((pair, pairIdx) => (
          <div key={pairIdx} className="comparison-pair">
            <div
              className={`position-card ${selectedPosition === `${pairIdx}-1` ? 'selected' : ''}`}
              onClick={() => {
                setSelectedPosition(`${pairIdx}-1`);
                onSelect(pair.position_1);
              }}
            >
              <div className="position-title">Position A</div>
              {renderPositionInfo(pair.position_1)}
              <button className="select-btn">Choose This Position</button>
            </div>

            {pair.position_2 && (
              <>
                <div className="vs-divider">VS</div>
                <div
                  className={`position-card ${selectedPosition === `${pairIdx}-2` ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPosition(`${pairIdx}-2`);
                    onSelect(pair.position_2);
                  }}
                >
                  <div className="position-title">Position B</div>
                  {renderPositionInfo(pair.position_2)}
                  <button className="select-btn">Choose This Position</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="actions">
        <button onClick={onBack} className="btn-back">
          Back to Opening Selection
        </button>
      </div>
    </div>
  );
}

export default PositionComparison;
