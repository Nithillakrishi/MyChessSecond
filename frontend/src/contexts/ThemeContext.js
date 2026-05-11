import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEMES = [
  { id: 'classic',  name: 'Classic',       swatch: '#E58B00',  desc: 'Walnut & amber' },
  { id: 'crimson',  name: 'Scarlet & Gold', swatch: '#E53E3E',  desc: 'Red meets gold' },
  { id: 'ocean',    name: 'Navy & Flame',   swatch: '#0EA5E9',  desc: 'Blue meets orange' },
  { id: 'violet',   name: 'Violet & Lime',  swatch: '#7C3AED',  desc: 'Purple meets lime' },
  { id: 'teal',     name: 'Teal & Coral',   swatch: '#0D9488',  desc: 'Teal meets coral' },
];

// Board square colors per theme
export const BOARD_COLORS = {
  classic: { dark: '#B58863', light: '#F0D9B5' },
  crimson: { dark: '#8B1A1A', light: '#F5E8D0' },
  ocean:   { dark: '#1B5480', light: '#E8D5A8' },
  violet:  { dark: '#5B2D8F', light: '#EDE8F5' },
  teal:    { dark: '#0D7060', light: '#E0F5F0' },
};

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
