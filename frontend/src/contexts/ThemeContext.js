import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  { id: 'classic', name: 'Classic',  swatch: '#7FA650', desc: 'Dark wood & cream' },
  { id: 'crimson', name: 'Crimson',  swatch: '#DC2626', desc: 'Red & white gradient' },
  { id: 'ocean',   name: 'Ocean',    swatch: '#0EA5E9', desc: 'Deep navy & cyan' },
  { id: 'obsidian',name: 'Obsidian', swatch: '#D4AF37', desc: 'Pure black & gold' },
  { id: 'emerald', name: 'Emerald',  swatch: '#10B981', desc: 'Forest green & lime' },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('mychess-theme') || 'classic'
  );

  function setTheme(id) {
    setThemeState(id);
    localStorage.setItem('mychess-theme', id);
    document.documentElement.setAttribute('data-theme', id);
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
