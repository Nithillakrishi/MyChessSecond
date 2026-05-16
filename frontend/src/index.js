import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { Analytics } from '@vercel/analytics/react';
import './index.css';

// Suppress Stockfish WebAssembly RuntimeErrors in the capture phase so
// React's dev error overlay never sees them.
window.addEventListener('error', (e) => {
  if (
    e.error instanceof WebAssembly.RuntimeError ||
    (e.message && (
      e.message.includes('unreachable') ||
      e.message.includes('null function') ||
      e.message.includes('RuntimeError') ||
      e.message.includes('wasm')
    ))
  ) {
    e.preventDefault();
    e.stopImmediatePropagation();
    console.warn('WASM error suppressed:', e.message);
    return true;
  }
}, true); // capture phase — fires before React's overlay listener

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
    <Analytics />
  </React.StrictMode>
);
