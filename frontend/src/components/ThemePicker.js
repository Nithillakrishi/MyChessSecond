import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import './ThemePicker.css';

// Secondary swatch colors (the "gold" complementary color of each theme)
const THEME_META = {
  classic: { a: '#8B5CF6', b: '#EC4899' },
  crimson: { a: '#EF4444', b: '#F59E0B' },
  ocean:   { a: '#06B6D4', b: '#3B82F6' },
  violet:  { a: '#A855F7', b: '#84CC16' },
  teal:    { a: '#10B981', b: '#F43F5E' },
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
