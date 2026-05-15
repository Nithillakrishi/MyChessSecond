import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpeningByMoves } from '../utils/openingDetector';
import './EngineTraining.css';
import { CHESS_PIECES } from './boardPieces';

function useMultiPV() {
  const engRef = useRef(null);
  const [lines, setLines] = useState([null, null, null, null, null]); // 5 PV lines
  const [score, setScore] = useState(0);
  const [ready, setReady] = useState(false);
  const pendingRef = useRef({ 1: null, 2: null, 3: null, 4: null, 5: null });

  useEffect(() => {
    const eng = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engRef.current = eng;
    eng.onerror = (e) => { console.warn('Stockfish worker error:', e); };

    eng.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line === 'readyok') setReady(true);

      if (line.startsWith('info') && line.includes('multipv')) {
        const pvMatch = line.match(/multipv (\d+)/);
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const pvIdx = line.indexOf(' pv ');

        if (!pvMatch) return;
        const n = parseInt(pvMatch[1]);

        let evalScore = null;
        if (cpMatch) evalScore = parseInt(cpMatch[1]) / 100;
        if (mateMatch) evalScore = parseInt(mateMatch[1]) > 0 ? 99 : -99;

        const pvMoves = pvIdx >= 0 ? line.slice(pvIdx + 4).trim().split(' ') : [];

        pendingRef.current[n] = { evalScore, pvMoves };

        // After receiving all 5 lines, commit
        if (pendingRef.current[1] && pendingRef.current[2] && pendingRef.current[3] && pendingRef.current[4] && pendingRef.current[5]) {
          const newLines = [1,2,3,4,5].map(i => pendingRef.current[i]);
          setLines(newLines);
          if (newLines[0]?.evalScore != null) setScore(newLines[0].evalScore);
          pendingRef.current = { 1: null, 2: null, 3: null, 4: null, 5: null };
        }
      }
    };

    eng.postMessage('uci');
    eng.postMessage('setoption name MultiPV value 5');
    eng.postMessage('ucinewgame');
    eng.postMessage('isready');
    return () => { eng.postMessage('quit'); eng.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engRef.current) return;
    pendingRef.current = { 1: null, 2: null, 3: null, 4: null, 5: null };
    engRef.current.postMessage('stop');
    engRef.current.postMessage(`position fen ${fen}`);
    engRef.current.postMessage('go depth 14');
  }, []);

  return { lines, score, ready, analyse };
}

/* Convert UCI moves to SAN sequence starting from a FEN */
function uciToSanLine(fen, uciMoves, maxMoves = 8) {
  try {
    const g = new Chess(fen);
    const sanMoves = [];
    for (const uci of uciMoves.slice(0, maxMoves)) {
      const from = uci.slice(0, 2);
      const to   = uci.slice(2, 4);
      const promo = uci[4] || undefined;
      const m = g.move({ from, to, promotion: promo || 'q' });
      if (!m) break;
      sanMoves.push({ san: m.san, color: m.color, fullMove: g.moveNumber(), ply: sanMoves.length });
    }
    return sanMoves;
  } catch {
    return [];
  }
}

function PVLine({ line, fen, lineNum, isWhiteTurn }) {
  if (!line) return (
    <div className="et-pv-row et-pv-loading">
      <span className="et-pv-num">{lineNum}</span>
      <span className="et-pv-eval et-pv-dim">—</span>
      <span className="et-pv-moves et-pv-dim">analysing…</span>
    </div>
  );

  const { evalScore, pvMoves } = line;
  const sanLine = uciToSanLine(fen, pvMoves, 10);

  // Adjust to white's perspective (Stockfish reports from side-to-move)
  const adjEval = evalScore == null ? null : (isWhiteTurn ? evalScore : -evalScore);

  const evalDisplay = adjEval == null ? '—'
    : adjEval >= 99 ? 'M'
    : adjEval <= -99 ? '-M'
    : (adjEval >= 0 ? `+${adjEval.toFixed(2)}` : adjEval.toFixed(2));

  const evalPos = adjEval == null ? 'neutral'
    : adjEval > 0.3 ? 'white'
    : adjEval < -0.3 ? 'black'
    : 'neutral';

  /* Build move sequence with move numbers */
  const tokens = [];
  let startMoveNum = null;
  try { startMoveNum = new Chess(fen).moveNumber(); } catch { startMoveNum = 1; }
  const startsBlack = !isWhiteTurn;

  sanLine.forEach((mv, i) => {
    const isWhiteMove = mv.color === 'w';
    if (isWhiteMove || (i === 0 && startsBlack)) {
      const num = startMoveNum + Math.floor((i + (startsBlack ? 1 : 0)) / 2);
      if (isWhiteMove) {
        tokens.push({ type: 'num', text: `${num}.` });
      } else if (i === 0) {
        tokens.push({ type: 'num', text: `${num}…` });
      }
    }
    tokens.push({ type: 'move', text: mv.san, key: i });
  });

  return (
    <div className="et-pv-row">
      <span className="et-pv-num">{lineNum}</span>
      <span className={`et-pv-eval et-pv-eval-${evalPos}`}>{evalDisplay}</span>
      <span className="et-pv-moves">
        {tokens.map((t, i) =>
          t.type === 'num'
            ? <span key={`n${i}`} className="et-pv-movenum">{t.text} </span>
            : <span key={`m${i}`} className="et-pv-movesym">{t.text} </span>
        )}
      </span>
    </div>
  );
}

const API_BASE = 'http://localhost:8000';

export default function EngineTraining({ username = '' }) {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(new Chess().fen());
  const [lastMove, setLastMove] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [posStats, setPosStats] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const { lines, score, ready, analyse } = useMultiPV();

  useEffect(() => {
    analyse(new Chess().fen());
  }, []); // eslint-disable-line

  useEffect(() => {
    setPosStats(null);
    fetch(`${API_BASE}/position-stats?fen=${encodeURIComponent(fen)}&username=${encodeURIComponent(username)}`)
      .then(r => r.json()).then(setPosStats).catch(() => {});
  }, [fen, username]);

  function applyHistory(sans) {
    const g = new Chess();
    for (const san of sans) { try { g.move(san); } catch {} }
    return g;
  }

  function commitMove(g, m, newHistory) {
    setGame(g); setFen(g.fen());
    setLastMove({ from: m.from, to: m.to });
    setHistory(newHistory); setSelectedSquare(null);
    analyse(g.fen());
  }

  function onDrop(from, to) {
    const g = new Chess(game.fen());
    let m;
    try { m = g.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!m) return false;
    commitMove(g, m, [...history, m.san]);
    return true;
  }

  function onSquareClick(square) {
    if (selectedSquare) {
      const g = new Chess(game.fen());
      let m;
      try { m = g.move({ from: selectedSquare, to: square, promotion: 'q' }); } catch {}
      if (m) { commitMove(g, m, [...history, m.san]); return; }
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
      else setSelectedSquare(null);
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
    }
  }

  function goBack() {
    if (history.length === 0) return;
    const newHistory = history.slice(0, -1);
    const g = applyHistory(newHistory);
    setGame(g); setFen(g.fen()); setLastMove(null);
    setHistory(newHistory); setSelectedSquare(null);
    analyse(g.fen());
  }

  function reset() {
    const g = new Chess();
    setGame(g); setFen(g.fen()); setLastMove(null);
    setHistory([]); setSelectedSquare(null);
    analyse(g.fen());
  }

  const isWhiteTurn = game.turn() === 'w';
  const adjustedScore = isWhiteTurn ? score : -score;
  const whitePct = Math.min(90, Math.max(10, 50 + adjustedScore * 4));
  const evalDisplay = ready
    ? (adjustedScore >= 0 ? `+${adjustedScore.toFixed(2)}` : adjustedScore.toFixed(2))
    : '—';

  const legalMoveDots = {};
  if (selectedSquare) {
    game.moves({ square: selectedSquare, verbose: true }).forEach(m => {
      legalMoveDots[m.to] = {
        background: game.get(m.to)
          ? 'radial-gradient(circle, rgba(0,0,0,.35) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.25) 30%, transparent 30%)',
        borderRadius: '50%',
      };
    });
  }
  const customSquareStyles = {
    ...(lastMove ? {
      [lastMove.from]: { background: 'rgba(229,139,0,0.35)' },
      [lastMove.to]:   { background: 'rgba(229,139,0,0.45)' },
    } : {}),
    ...(selectedSquare ? { [selectedSquare]: { background: 'rgba(255,215,0,0.55)' } } : {}),
    ...legalMoveDots,
  };

  return (
    <div className="et-root">
      <div className="et-layout">
        {/* Board column */}
        <div className="et-board-col">
          <div className="et-board-inner">
            {/* Eval bar — swap order when flipped so bottom always matches board's bottom color */}
            <div className="et-eval-wrap">
              <div className="et-eval-bar-outer">
                {flipped ? (
                  <>
                    <div className="et-eval-white" style={{ height: `${whitePct}%` }} />
                    <div className="et-eval-black" style={{ height: `${100 - whitePct}%` }} />
                  </>
                ) : (
                  <>
                    <div className="et-eval-black" style={{ height: `${100 - whitePct}%` }} />
                    <div className="et-eval-white" style={{ height: `${whitePct}%` }} />
                  </>
                )}
              </div>
              <div className="et-eval-score-badge">{evalDisplay}</div>
            </div>

            <div className="et-board-wrap">
              <Chessboard customPieces={CHESS_PIECES}
                position={fen}
                onPieceDrop={onDrop}
                onSquareClick={onSquareClick}
                boardOrientation={flipped ? 'black' : 'white'}
                customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
                customDarkSquareStyle={{ backgroundColor: boardDark }}
                customLightSquareStyle={{ backgroundColor: boardLight }}
                customSquareStyles={customSquareStyles}
              />
            </div>
          </div>

          <OpeningBadge opening={detectOpeningByMoves(history)} />

          {/* Move history */}
          <div className="et-history">
            {history.length === 0
              ? <span className="et-history-empty">Play a move to begin</span>
              : history.map((m, i) => (
                  <span key={i} className="et-hist-move">
                    {i % 2 === 0 && <span className="et-hist-num">{Math.floor(i/2)+1}.</span>}
                    {m}
                  </span>
                ))}
          </div>

          <div className="et-controls">
            <button className="et-ctrl-btn" onClick={goBack} disabled={history.length === 0}>← Back</button>
            <button className="et-ctrl-btn" onClick={reset}>Reset</button>
            <button className="et-ctrl-btn et-ctrl-flip" onClick={() => setFlipped(f => !f)} title="Flip board">⇅</button>
          </div>
        </div>

        {/* Engine panel */}
        <div className="et-panel">
          <div className="et-panel-header">
            <span className="et-panel-title">Stockfish 18 · Engine Lines</span>
            <div className="et-eval-badge">{evalDisplay}</div>
          </div>

          <div className="et-depth-row">
            <span className="et-depth-label">
              {isWhiteTurn ? 'White to move' : 'Black to move'}
            </span>
            {!ready && <span className="et-loading">loading engine…</span>}
          </div>

          <div className="et-pv-list">
            {[1, 2, 3, 4, 5].map(n => (
              <PVLine
                key={n}
                line={lines[n - 1]}
                fen={fen}
                lineNum={n}
                isWhiteTurn={isWhiteTurn}
              />
            ))}
          </div>

          {/* Position stats — stat cards */}
          {posStats !== null && (
            <div className="et-pos-stats">
              <div className="et-pos-stats-header">
                <span className="et-pos-stats-title">This Position in Your Games</span>
                {posStats.games > 0 && <span className="et-pos-stats-games">{posStats.games.toLocaleString()} games</span>}
              </div>
              {posStats.games === 0 ? (
                <span className="et-pos-stats-empty">You haven't reached this position yet</span>
              ) : (() => {
                const total = posStats.games;
                const wPct = Math.round(posStats.wins  / total * 100);
                const dPct = Math.round(posStats.draws / total * 100);
                const lPct = 100 - wPct - dPct;
                const cards = [
                  { label: 'Wins',   pct: wPct, count: posStats.wins,   cls: 'w' },
                  { label: 'Draws',  pct: dPct, count: posStats.draws,  cls: 'd' },
                  { label: 'Losses', pct: lPct, count: posStats.losses, cls: 'l' },
                ];
                return (
                  <div className="et-pos-cards">
                    {cards.map(({ label, pct, count, cls }) => (
                      <div key={cls} className={`et-pos-card et-pos-card-${cls}`}>
                        <div className="et-pos-card-pct">{pct}%</div>
                        <div className="et-pos-card-label">{label}</div>
                        <div className="et-pos-card-count">{count.toLocaleString()} games</div>
                        <div className="et-pos-card-bar">
                          <div className="et-pos-card-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
