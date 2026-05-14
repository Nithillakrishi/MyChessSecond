import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  { id: 'classic',  name: 'Midnight Purple', swatch: '#8B5CF6',  desc: 'Electric violet & pink' },
  { id: 'crimson',  name: 'Scarlet Nova',    swatch: '#EF4444',  desc: 'Crimson & amber fire' },
  { id: 'ocean',    name: 'Cyber Ocean',     swatch: '#06B6D4',  desc: 'Cyan & electric blue' },
  { id: 'violet',   name: 'Neon Violet',     swatch: '#A855F7',  desc: 'Vivid purple & lime' },
  { id: 'teal',     name: 'Emerald Dark',    swatch: '#10B981',  desc: 'Emerald & hot coral' },
];

// Board square colors per theme — tuned to match each theme's chrome.
// classic = Midnight Purple, crimson = Scarlet, ocean = Cyber Ocean,
// violet = Neon Violet, teal = Emerald Dark.
export const BOARD_COLORS = {
  classic: { dark: '#5C3D8F', light: '#E5D8F2' },  // deep violet · lavender cream
  crimson: { dark: '#8B2424', light: '#F2E0CC' },  // wine red · warm cream
  ocean:   { dark: '#1D4C7A', light: '#DCE8F2' },  // cobalt · cool cream
  violet:  { dark: '#6B2BB5', light: '#EAE0F5' },  // royal purple · pale lavender
  teal:    { dark: '#157760', light: '#DCEFE6' },  // emerald · mint cream
};

// Stockfish arrow base colour per theme — chosen to contrast clearly against the board squares.
export const ARROW_BASE_COLOR = {
  classic: '250,204,21',   // bright yellow — pops on purple board
  crimson: '34,211,238',   // cyan — pops on red board
  ocean:   '250,204,21',   // bright yellow — pops on blue board
  violet:  '163,230,53',   // lime — pops on purple board
  teal:    '250,204,21',   // bright yellow — pops on green board
};

// Opacity steps: best move → faintest (5th), still clearly visible at every level
export const ARROW_ALPHAS = [1.0, 0.82, 0.62, 0.45, 0.30];

export function useArrowColors() {
  const { theme } = useContext(ThemeContext);
  const rgb = ARROW_BASE_COLOR[theme] || ARROW_BASE_COLOR.classic;
  return ARROW_ALPHAS.map(a => `rgba(${rgb},${a})`);
}

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

export function useBoardColors() {
  const { theme } = useTheme();
  return BOARD_COLORS[theme] || BOARD_COLORS.classic;
}
