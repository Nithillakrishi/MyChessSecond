import React, { useState } from 'react';
import './OpeningSelector.css';

function OpeningSelector({ profile, onSelect, disabled }) {
  const [selectedColor, setSelectedColor] = useState('white');
  const [selectedMoves, setSelectedMoves] = useState([]);

  const commonOpenings = {
    white: [
      { moves: ['e2e4'], name: 'e4', description: 'Italian, Spanish, French defenses' },
      { moves: ['d2d4'], name: 'd4', description: 'Queen\'s Gambit, Indian openings' },
      { moves: ['c2c4'], name: 'c4', description: 'English opening' },
      { moves: ['g1f3'], name: 'Nf3', description: 'Reti opening' },
    ],
    black: [
      { moves: ['e7e5'], name: 'e5', description: 'Open games' },
      { moves: ['c7c5'], name: 'c5', description: 'Sicilian Defense' },
      { moves: ['e7e6'], name: 'e6', description: 'French Defense' },
      { moves: ['d7d5'], name: 'd5', description: 'Closed openings' },
    ]
  };

  const handleOpeningSelect = (moves) => {
    setSelectedMoves(moves);
  };

  const handleContinue = () => {
    if (selectedMoves.length > 0) {
      onSelect(selectedColor, selectedMoves);
    }
  };

  return (
    <div className="opening-selector">
      <div className="card">
        <h2>Choose Your Opening</h2>
        <p>Select the color and opening you want to study</p>

        <div className="color-selector">
          <label>
            <input
              type="radio"
              value="white"
              checked={selectedColor === 'white'}
              onChange={(e) => {
                setSelectedColor(e.target.value);
                setSelectedMoves([]);
              }}
            />
            <span>Play as White</span>
          </label>
          <label>
            <input
              type="radio"
              value="black"
              checked={selectedColor === 'black'}
              onChange={(e) => {
                setSelectedColor(e.target.value);
                setSelectedMoves([]);
              }}
            />
            <span>Play as Black</span>
          </label>
        </div>

        <div className="openings-grid">
          <h3>Common Openings for {selectedColor.toUpperCase()}:</h3>
          {commonOpenings[selectedColor].map((opening, idx) => (
            <div
              key={idx}
              className={`opening-card ${selectedMoves.join() === opening.moves.join() ? 'selected' : ''}`}
              onClick={() => handleOpeningSelect(opening.moves)}
            >
              <div className="opening-code">{opening.name}</div>
              <div className="opening-desc">{opening.description}</div>
            </div>
          ))}
        </div>

        <div className="or-divider">
          <span>OR</span>
        </div>

        <div className="custom-moves">
          <h3>Enter Custom Moves (UCI format):</h3>
          <input
            type="text"
            placeholder="e.g., e2e4 c7c5"
            onChange={(e) => {
              const moves = e.target.value.trim().split(' ').filter(m => m.length > 0);
              if (moves.length > 0) {
                setSelectedMoves(moves);
              }
            }}
          />
        </div>

        <button
          onClick={handleContinue}
          disabled={disabled || selectedMoves.length === 0}
          className="btn-primary"
        >
          {disabled ? 'Loading...' : 'Find Positions'}
        </button>
      </div>
    </div>
  );
}

export default OpeningSelector;
