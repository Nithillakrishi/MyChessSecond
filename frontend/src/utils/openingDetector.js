import openings from '../data/openings.json';
import { Chess } from 'chess.js';

// ── Map 1: EPD → opening (position-based, handles transpositions)
// En passant is normalized to '-' because the lichess dataset omits it even when
// technically present (e.g. after 1.e4 c5, chess.js gives "w KQkq c6" but dataset has "w KQkq -").
const epdMap = new Map();
for (const o of openings) {
  if (!o.epd) continue;
  const parts = o.epd.split(' ');
  parts[3] = '-';
  epdMap.set(parts.join(' '), { eco: o.eco, name: o.name });
}

// ── Map 2: move-sequence → opening (sequence-based, direct PGN prefix match)
// Key: "e4 e5 Nf3 Nc6 Bb5"  (space-separated SAN, no move numbers)
const movesMap = new Map();
for (const o of openings) {
  if (o.moves) movesMap.set(o.moves, { eco: o.eco, name: o.name });
}

function fenToEpd(fen) {
  const parts = fen.split(' ');
  parts[3] = '-';
  return parts.slice(0, 4).join(' ');
}

/**
 * Detect opening from a FEN history array (position-based).
 * Walks backwards to find the deepest matching EPD.
 */
export function detectOpening(fenHistory = []) {
  for (let i = fenHistory.length - 1; i >= 0; i--) {
    const entry = epdMap.get(fenToEpd(fenHistory[i]));
    if (entry) return entry;
  }
  return null;
}

/**
 * Detect opening from a SAN move history array (move-sequence-based).
 * Tries progressively shorter prefixes to find the deepest match.
 * e.g. ["e4","e5","Nf3","Nc6","Bb5"] → checks full sequence first, then shorter.
 */
export function detectOpeningByMoves(sanHistory = []) {
  for (let i = sanHistory.length; i > 0; i--) {
    const key = sanHistory.slice(0, i).join(' ');
    const entry = movesMap.get(key);
    if (entry) return entry;
  }
  return null;
}

/**
 * Detect opening from a Chess game object.
 * Uses both EPD and move-sequence approaches and returns the deepest match.
 */
export function detectOpeningFromGame(game) {
  if (!game) return null;
  const moves = game.history();
  const g = new Chess();

  let bestEpd = epdMap.get(fenToEpd(g.fen())) || null;
  let bestMove = null;
  const sanHistory = [];

  for (const san of moves) {
    try { g.move(san); } catch { break; }
    sanHistory.push(san);

    const foundEpd = epdMap.get(fenToEpd(g.fen()));
    if (foundEpd) bestEpd = foundEpd;

    const foundMove = movesMap.get(sanHistory.join(' '));
    if (foundMove) bestMove = foundMove;
  }

  // Prefer whichever method matched deeper (move-sequence is exact, EPD handles transpositions)
  // If both matched, prefer EPD (more specific to actual position reached)
  return bestEpd || bestMove || null;
}
