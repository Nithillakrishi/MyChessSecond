/* ────────────────────────────────────────────────────────────
   Shared custom-piece renderer for react-chessboard.
   Uses unicode chess glyphs styled to match the landing page —
   off-white whites with a soft drop-shadow, deep-ink blacks.
   These work cleanly on any of the 5 theme board colors.
   ──────────────────────────────────────────────────────────── */
import React from 'react';

const GLYPHS = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

function makePiece(glyph, isWhite) {
  return function ChessPiece({ squareWidth }) {
    const size = (squareWidth || 64) * 0.86;
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size,
        lineHeight: 1,
        color: isWhite ? '#fafafa' : '#0e0d10',
        textShadow: isWhite
          ? '0 2px 0 rgba(0,0,0,0.55), 0 0 8px rgba(0,0,0,0.45)'
          : '0 1px 0 rgba(255,255,255,0.18)',
        userSelect: 'none',
        pointerEvents: 'none',
        fontFamily: '"Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", "Noto Sans Symbols2", serif',
        transform: 'translateY(-2%)',
      }}>{glyph}</div>
    );
  };
}

export const CHESS_PIECES = Object.fromEntries(
  Object.entries(GLYPHS).map(([k, g]) => [k, makePiece(g, k.startsWith('w'))])
);

export default CHESS_PIECES;
