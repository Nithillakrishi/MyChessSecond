import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.css';

// Suppress Stockfish WebAssembly RuntimeErrors — they don't affect
// functionality but trigger the React dev error overlay when multiple
// WASM workers run concurrently.
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('RuntimeError') || e.message.includes('null function'))) {
    e.preventDefault();
    e.stopPropagation();
    return true;
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
