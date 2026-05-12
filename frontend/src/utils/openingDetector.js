import openings from '../data/openings.json';
import { Chess } from 'chess.js';

// Build a Map from normalized-EPD → {eco, name} for O(1) lookup
// EPDs are normalized: en passant field set to '-' so they match chess.js output
const epdMap = new Map();
for (const o of openings) {
  if (!o.epd) continue;
  const parts = o.epd.split(' ');
  parts[3] = '-';
  epdMap.set(parts.join(' '), { eco: o.eco, name: o.name });
}

// EPD = first 4 parts of FEN, with en passant normalized to '-'
// The lichess ECO dataset omits en passant squares even when technically present,
// so we strip them to guarantee matches (e.g. after 1.e4 c5, chess.js gives "w KQkq c6"
// but the dataset has "w KQkq -").
function fenToEpd(fen) {
  const parts = fen.split(' ');
  parts[3] = '-';
  return parts.slice(0, 4).join(' ');
}

/**
 * Returns the deepest matching opening from a FEN history array.
 */
export function detectOpening(fenHistory = []) {
  for (let i = fenHistory.length - 1; i >= 0; i--) {
    const entry = epdMap.get(fenToEpd(fenHistory[i]));
    if (entry) return entry;
  }
  return null;
}

/**
 * Replays the game's move history to find the deepest matching opening.
 * Use this in components that have a Chess game object but not a FEN history array.
 */
export function detectOpeningFromGame(game) {
  if (!game) return null;
  const moves = game.history();
  const g = new Chess();
  let best = epdMap.get(fenToEpd(g.fen())) || null;
  for (const san of moves) {
    try { g.move(san); } catch { break; }
    const found = epdMap.get(fenToEpd(g.fen()));
    if (found) best = found;
  }
  return best;
}
