import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemePicker.css';

// Secondary swatch colors (the "gold" complementary color of each theme)
const THEME_META = {
  classic: { a: '#7FA650', b: '#E58B00' },
  crimson: { a: '#E53E3E', b: '#F4C430' },
  ocean:   { a: '#0EA5E9', b: '#F97316' },
  violet:  { a: '#7C3AED', b: '#A3E635' },
  teal:    { a: '#0D9488', b: '#FB7185' },
};

export default function ThemePicker({ compact = false }) {
  const { theme, setTheme, themes } = useTheme();
  const [tooltip, setTooltip] = useState(null);

  return (
    <div className={`tp-root ${compact ? 'tp-compact' : ''}`}>
      {!compact && <span className="tp-label">Theme</span>}
      <div className="tp-swatches">
        {themes.map(t => {
          const meta = THEME_META[t.id] || { a: t.swatch, b: t.swatch };
          return (
            <button
              key={t.id}
              className={`tp-swatch ${theme === t.id ? 'tp-active' : ''}`}
              style={{ '--color-a': meta.a, '--color-b': meta.b }}
              onClick={() => setTheme(t.id)}
              onMouseEnter={() => setTooltip(t.id)}
              onMouseLeave={() => setTooltip(null)}
              title={t.name}
            >
              {tooltip === t.id && (
                <span className="tp-tooltip">{t.name}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
