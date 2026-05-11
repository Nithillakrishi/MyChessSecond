import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemePicker.css';

export default function ThemePicker({ compact = false }) {
  const { theme, setTheme, themes } = useTheme();
  const [tooltip, setTooltip] = useState(null);

  return (
    <div className={`tp-root ${compact ? 'tp-compact' : ''}`}>
      {!compact && <span className="tp-label">Theme</span>}
      <div className="tp-swatches">
        {themes.map(t => (
          <button
            key={t.id}
            className={`tp-swatch ${theme === t.id ? 'tp-active' : ''}`}
            style={{ '--swatch': t.swatch }}
            onClick={() => setTheme(t.id)}
            onMouseEnter={() => setTooltip(t.id)}
            onMouseLeave={() => setTooltip(null)}
            title={t.name}
          >
            {tooltip === t.id && (
              <span className="tp-tooltip">{t.name}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
