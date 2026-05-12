import React from 'react';
import './OpeningBadge.css';

export default function OpeningBadge({ opening }) {
  if (!opening) return null;
  return (
    <div className="ob-root">
      <span className="ob-eco">{opening.eco}</span>
      <span className="ob-name">{opening.name}</span>
    </div>
  );
}
