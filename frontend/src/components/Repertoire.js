import React from 'react';
import './Repertoire.css';

function Repertoire({ data, onReset }) {
  if (!data || !data.recommended_lines) {
    return <div>No data available</div>;
  }

  return (
    <div className="repertoire-card">
      <div className="repertoire-header">
        <h2>Your Personalized Opening Repertoire</h2>
        <p>{data.message}</p>
        <div className="tags">
          <span className="tag">Color: {data.color}</span>
          <span className="tag">Your first moves: {data.desired_first_moves.join(' ')}</span>
          <span className="tag play-style">Styles: {data.preferred_position_types.join(', ')}</span>
        </div>
      </div>

      <div className="lines-container">
        {data.recommended_lines.length === 0 && (
          <p>No matching lines found for exactly your criteria. Try adjusting your preferences!</p>
        )}
        
        {data.recommended_lines.map((line, index) => (
          <div key={index} className="line-card">
            <div className="line-header">
              <h3>Line {index + 1}: {line.opening}</h3>
              {line.outcome && (
                <span className={`outcome-badge ${line.outcome}`}>
                  Historical Result: {line.outcome.toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="moves-display">
              <strong>Moves to play:</strong> {line.moves.join(' ')} ...
            </div>
            
            <div className="reached-styles">
              <strong>Positions you'll reach:</strong> 
              <ul>
                {Array.from(new Set(line.position_types_reached)).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <button className="reset-btn" onClick={onReset}>Start Over / Try Another Player</button>
    </div>
  );
}

export default Repertoire;