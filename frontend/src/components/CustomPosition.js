import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpeningByMoves } from '../utils/openingDetector';
import './CustomPosition.css';
import { CHESS_PIECES } from './boardPieces';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const EXAMPLE_FENS = [
  { label: 'Starting position', fen: STARTING_FEN },
  { label: "Sicilian (after 1.e4 c5)", fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2' },
  { label: "Queen's Gambit", fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2' },
  { label: 'King\'s Indian (classical)', fen: 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 7' },
  { label: 'Endgame — Rook vs King', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' },
];

function useStockfishAnalyser() {
  const engineRef    = useRef(null);
  const nextFenRef   = useRef(null);
  const stoppingRef  = useRef(false);
  const isReadyRef   = useRef(false);
  const isSearchRef  = useRef(false);
  const [sfInfo, setSfInfo] = useState({ score: 0, type: 'cp', depth: 0, bestMove: null, ready: false });
  const [lines, setLines] = useState([null, null, null, null]);

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;

    const startSearch = (fen) => {
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage('go depth 22');
      isSearchRef.current = true;
      stoppingRef.current = false;
    };

    engine.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? e.data : String(e.data);

      if (msg === 'readyok') {
        isReadyRef.current = true;
        setSfInfo(p => ({ ...p, ready: true }));
        if (nextFenRef.current) {
          const fen = nextFenRef.current;
          nextFenRef.current = null;
          startSearch(fen);
        }
        return;
      }

      if (msg.startsWith('bestmove')) {
        isSearchRef.current = false;
        stoppingRef.current = false;
        const bm = msg.match(/bestmove (\S+)/);
        if (bm && bm[1] !== '(none)') setSfInfo(p => ({ ...p, bestMove: bm[1] }));
        if (nextFenRef.current) {
          const fen = nextFenRef.current;
          nextFenRef.current = null;
          startSearch(fen);
        }
        return;
      }

      if (stoppingRef.current) return;

      if (msg.startsWith('info') && msg.includes('multipv')) {
        const pvM    = msg.match(/multipv (\d+)/);
        const cpM    = msg.match(/score cp (-?\d+)/);
        const mateM  = msg.match(/score mate (-?\d+)/);
        const depM   = msg.match(/\bdepth (\d+)/);
        const pvIdx  = msg.indexOf(' pv ');
        if (!pvM) return;
        const n     = parseInt(pvM[1]);
        const depth = depM ? parseInt(depM[1]) : 0;
        if (depth < 6) return;
        let evalScore = null;
        if (cpM)   evalScore = parseInt(cpM[1]) / 100;
        if (mateM) evalScore = parseInt(mateM[1]) > 0 ? 99 : -99;
        const pvMoves = pvIdx >= 0 ? msg.slice(pvIdx + 4).trim().split(' ').slice(0, 8) : [];
        if (n === 1) setSfInfo(p => ({ ...p, score: evalScore ?? p.score, type: mateM ? 'mate' : 'cp', depth }));
        setLines(prev => { const next = [...prev]; next[n - 1] = { evalScore, pvMoves }; return next; });
      }
    };

    engine.postMessage('uci');
    engine.postMessage('setoption name MultiPV value 4');
    engine.postMessage('ucinewgame');
    engine.postMessage('isready');
    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engineRef.current) return;
    setSfInfo(p => ({ ...p, bestMove: null, depth: 0 }));
    setLines([null, null, null, null]);
    if (!isReadyRef.current) {
      // Engine not ready yet — queue; readyok handler will start it
      nextFenRef.current = fen;
      return;
    }
    if (isSearchRef.current) {
      // Engine busy — stop it, queue new FEN
      nextFenRef.current = fen;
      stoppingRef.current = true;
      engineRef.current.postMessage('stop');
    } else {
      // Engine idle — start directly
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage('go depth 22');
      isSearchRef.current = true;
    }
  }, []);

  return { sfInfo, lines, analyse };
}

function PVLine({ line, fen, lineNum, isWhiteTurn }) {
  if (!line) return (
    <div className="cp-pv-row cp-pv-loading">
      <span className="cp-pv-num">{lineNum}</span>
      <span className="cp-pv-eval">—</span>
      <span className="cp-pv-moves">analysing…</span>
    </div>
  );
  const { evalScore, pvMoves } = line;
  const adj = evalScore == null ? null : (isWhiteTurn ? evalScore : -evalScore);
  const evalStr = adj == null ? '—'
    : adj >= 99 ? 'M' : adj <= -99 ? '-M'
    : (adj >= 0 ? `+${adj.toFixed(2)}` : adj.toFixed(2));
  const cls = adj == null ? '' : adj > 0.3 ? 'cp-pv-pos' : adj < -0.3 ? 'cp-pv-neg' : 'cp-pv-neu';
  const sans = [];
  try {
    const g = new Chess(fen);
    let moveNum = g.moveNumber();
    let firstBlack = g.turn() === 'b';
    for (const uci of pvMoves.slice(0, 7)) {
      const r = g.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || 'q' });
      if (!r) break;
      sans.push({ san: r.san, white: r.color === 'w', num: moveNum, first: sans.length === 0 && firstBlack });
      if (r.color === 'b') moveNum++;
    }
  } catch {}
  return (
    <div className="cp-pv-row">
      <span className="cp-pv-num">{lineNum}</span>
      <span className={`cp-pv-eval ${cls}`}>{evalStr}</span>
      <span className="cp-pv-moves">
        {sans.map((m, i) => (
          <React.Fragment key={i}>
            {(m.white || m.first) && <span className="cp-pv-movenum">{m.num}{m.white ? '.' : '…'}</span>}
            <span className="cp-pv-movesym">{m.san} </span>
          </React.Fragment>
        ))}
      </span>
    </div>
  );
}

function uciToSan(fen, uciMove) {
  if (!uciMove) return null;
  try {
    const g = new Chess(fen);
    const res = g.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] || 'q' });
    return res?.san || null;
  } catch { return null; }
}

function evalLabel(sfInfo, isWhiteTurn) {
  if (!sfInfo.ready) return '—';
  const sign = isWhiteTurn ? 1 : -1;
  if (sfInfo.type === 'mate') return `M${sfInfo.score * sign}`;
  return ((sfInfo.score * sign) >= 0 ? '+' : '') + (sfInfo.score * sign).toFixed(2);
}

export default function CustomPosition() {
  const { dark: boardDark, light: boardLight } = useBoardColors();

  // ── Mode ──
  const [mode, setMode] = useState('position'); // 'position' | 'pgn'

  // ── Position mode ──
  const [fenInput, setFenInput] = useState(STARTING_FEN);
  const [fenError, setFenError]  = useState('');
  const [game, setGame]           = useState(new Chess());
  const [fen, setFen]             = useState(STARTING_FEN);
  const [sanHistory, setSanHistory] = useState([]);
  const startFenRef = useRef(STARTING_FEN);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [lastMove, setLastMove]   = useState(null);

  // ── PGN mode ──
  const [pgnInput, setPgnInput] = useState('');
  const [pgnError, setPgnError] = useState('');
  const [pgnFens, setPgnFens]   = useState([]);
  const [pgnMoves, setPgnMoves] = useState([]);
  const [pgnIdx, setPgnIdx]     = useState(0);
  const [pgnHeaders, setPgnHeaders] = useState({});
  const moveListRef = useRef(null);

  const { sfInfo, lines, analyse } = useStockfishAnalyser();

  const loadFen = useCallback((f) => {
    try {
      const g = new Chess(f.trim());
      setGame(g);
      setFen(g.fen());
      setFenInput(g.fen());
      startFenRef.current = g.fen();
      setFenError('');
      setLastMove(null);
      setSanHistory([]);
      setSelectedSquare(null);
      analyse(g.fen());
    } catch {
      setFenError('Invalid FEN string. Please check and try again.');
    }
  }, [analyse]);

  useEffect(() => {
    analyse(STARTING_FEN);
  }, []); // eslint-disable-line

  // ── PGN loader ──
  function loadPgnGame(text) {
    try {
      const g = new Chess();
      g.loadPgn(text.trim());
      const headers = g.header();
      const history = g.history({ verbose: true });
      const g2 = new Chess();
      const fens = [g2.fen()];
      const sans = [];
      for (const m of history) {
        g2.move(m.san);
        fens.push(g2.fen());
        sans.push(m.san);
      }
      setPgnHeaders(headers);
      setPgnFens(fens);
      setPgnMoves(sans);
      setPgnIdx(0);
      setPgnError('');
      analyse(fens[0]);
    } catch {
      setPgnError('Invalid PGN. Please check format and try again.');
    }
  }

  function pgnGoTo(idx) {
    if (pgnFens.length === 0) return;
    const clamped = Math.max(0, Math.min(pgnFens.length - 1, idx));
    setPgnIdx(clamped);
    analyse(pgnFens[clamped]);
  }

  // Keyboard navigation in PGN mode
  useEffect(() => {
    if (mode !== 'pgn' || pgnFens.length === 0) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') {
        setPgnIdx(prev => { const n = Math.max(0, prev - 1); analyse(pgnFens[n]); return n; });
      } else if (e.key === 'ArrowRight') {
        setPgnIdx(prev => { const n = Math.min(pgnFens.length - 1, prev + 1); analyse(pgnFens[n]); return n; });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mode, pgnFens, analyse]);

  // Auto-scroll active move into view
  useEffect(() => {
    if (!moveListRef.current) return;
    const active = moveListRef.current.querySelector('.cp-ml-active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [pgnIdx]);

  function commitMove(g, move, newHistory) {
    setGame(g); setFen(g.fen()); setFenInput(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setFenError('');
    setSanHistory(newHistory); setSelectedSquare(null);
    analyse(g.fen());
  }

  function onDrop(from, to) {
    const g = new Chess(game.fen());
    let move;
    try { move = g.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    commitMove(g, move, [...sanHistory, move.san]);
    return true;
  }

  function onSquareClick(square) {
    if (selectedSquare) {
      const g = new Chess(game.fen());
      let move;
      try { move = g.move({ from: selectedSquare, to: square, promotion: 'q' }); } catch {}
      if (move) { commitMove(g, move, [...sanHistory, move.san]); return; }
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
      else setSelectedSquare(null);
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
    }
  }

  function playBestMove() {
    if (!sfInfo.bestMove) return;
    const g = new Chess(game.fen());
    const m = g.move({ from: sfInfo.bestMove.slice(0, 2), to: sfInfo.bestMove.slice(2, 4), promotion: sfInfo.bestMove[4] || 'q' });
    if (!m) return;
    setGame(g);
    setFen(g.fen());
    setFenInput(g.fen());
    setLastMove({ from: m.from, to: m.to });
    setSanHistory(h => [...h, m.san]);
    analyse(g.fen());
  }

  function goBack() {
    setSanHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = prev.slice(0, -1);
      const base = new Chess(startFenRef.current);
      for (const san of newHistory) { try { base.move(san); } catch {} }
      setGame(base);
      setFen(base.fen());
      setFenInput(base.fen());
      setLastMove(null);
      setSelectedSquare(null);
      analyse(base.fen());
      return newHistory;
    });
  }

  // Derived values
  const activeFen = mode === 'pgn' && pgnFens.length > 0 ? pgnFens[pgnIdx] : fen;
  const activeHistory = mode === 'pgn' ? pgnMoves.slice(0, pgnIdx) : sanHistory;

  const legalMoveDots = {};
  if (mode === 'position' && selectedSquare) {
    game.moves({ square: selectedSquare, verbose: true }).forEach(m => {
      legalMoveDots[m.to] = {
        background: game.get(m.to)
          ? 'radial-gradient(circle, rgba(0,0,0,.35) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.25) 30%, transparent 30%)',
        borderRadius: '50%',
      };
    });
  }
  const customSquareStyles = mode === 'position' ? {
    ...(lastMove ? {
      [lastMove.from]: { background: 'rgba(229,139,0,0.35)' },
      [lastMove.to]:   { background: 'rgba(229,139,0,0.45)' },
    } : {}),
    ...(selectedSquare ? { [selectedSquare]: { background: 'rgba(255,215,0,0.55)' } } : {}),
    ...legalMoveDots,
  } : {};

  const activeChess = (() => { try { return new Chess(activeFen); } catch { return new Chess(); } })();
  const isWhiteTurn = activeChess.turn() === 'w';
  const evalVal = evalLabel(sfInfo, isWhiteTurn);
  const bestSan = mode === 'position' ? uciToSan(activeFen, sfInfo.bestMove) : null;
  const boardSize = Math.min(500, Math.max(300, window.innerWidth - 420));

  return (
    <div className="cp-root">
      {/* Mode tabs */}
      <div className="cp-mode-tabs">
        <button
          className={`cp-mode-tab ${mode === 'position' ? 'cp-mode-tab-active' : ''}`}
          onClick={() => setMode('position')}
        >
          Custom Position
        </button>
        <button
          className={`cp-mode-tab ${mode === 'pgn' ? 'cp-mode-tab-active' : ''}`}
          onClick={() => setMode('pgn')}
        >
          Load Game
        </button>
      </div>

      {/* FEN bar — position mode */}
      {mode === 'position' && (
        <div className="cp-fen-bar">
          <div className="cp-fen-input-wrap">
            <input
              className={`cp-fen-input ${fenError ? 'cp-fen-error' : ''}`}
              value={fenInput}
              onChange={e => setFenInput(e.target.value)}
              placeholder="Paste FEN string…"
              onKeyDown={e => e.key === 'Enter' && loadFen(fenInput)}
              spellCheck={false}
            />
            <button className="cp-load-btn" onClick={() => loadFen(fenInput)}>Load</button>
          </div>
          {fenError && <span className="cp-fen-err-msg">{fenError}</span>}
          <div className="cp-examples">
            {EXAMPLE_FENS.map(ex => (
              <button key={ex.label} className="cp-example-chip" onClick={() => loadFen(ex.fen)}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PGN bar — pgn mode */}
      {mode === 'pgn' && (
        <div className="cp-pgn-bar">
          <div className="cp-pgn-input-wrap">
            <textarea
              className={`cp-pgn-textarea ${pgnError ? 'cp-fen-error' : ''}`}
              value={pgnInput}
              onChange={e => setPgnInput(e.target.value)}
              placeholder="Paste PGN here… (e.g. from Chess.com, Lichess, or any PGN export)"
              spellCheck={false}
              rows={3}
            />
            <button className="cp-load-btn cp-pgn-load-btn" onClick={() => loadPgnGame(pgnInput)}>
              Load
            </button>
          </div>
          {pgnError && <span className="cp-fen-err-msg">{pgnError}</span>}
        </div>
      )}

      {/* Main layout */}
      <div className="cp-layout">
        {/* Board */}
        <div className="cp-board-col">
          <div className="cp-eval-bar-wrap">
            <div className="cp-eval-bar-outer" style={{ height: boardSize }}>
              <div className="cp-eval-bar-black" style={{ height: `${Math.min(90, Math.max(10, 50 - (isWhiteTurn ? sfInfo.score : -sfInfo.score) * 4))}%` }} />
              <div className="cp-eval-bar-white" style={{ height: `${Math.min(90, Math.max(10, 50 + (isWhiteTurn ? sfInfo.score : -sfInfo.score) * 4))}%` }} />
            </div>
            <div className="cp-eval-score-badge">{sfInfo.ready ? evalVal : '—'}</div>
          </div>
          <div className="cp-board-wrap" style={{ width: boardSize }}>
            <Chessboard customPieces={CHESS_PIECES}
              position={activeFen}
              onPieceDrop={mode === 'position' ? onDrop : () => false}
              onSquareClick={mode === 'position' ? onSquareClick : undefined}
              arePiecesDraggable={mode === 'position'}
              boardOrientation="white"
              boardWidth={boardSize}
              customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
              customDarkSquareStyle={{ backgroundColor: boardDark }}
              customLightSquareStyle={{ backgroundColor: boardLight }}
              customSquareStyles={customSquareStyles}
            />
          </div>

          {/* PGN navigation — below board */}
          {mode === 'pgn' && pgnFens.length > 0 && (
            <div className="cp-pgn-nav">
              <button className="cp-pgn-nav-btn" onClick={() => pgnGoTo(0)} disabled={pgnIdx === 0} title="First move">⏮</button>
              <button className="cp-pgn-nav-btn" onClick={() => pgnGoTo(pgnIdx - 1)} disabled={pgnIdx === 0} title="Previous (←)">◀</button>
              <span className="cp-pgn-pos-label">
                {pgnIdx === 0 ? 'Start' : `Move ${pgnIdx} / ${pgnFens.length - 1}`}
              </span>
              <button className="cp-pgn-nav-btn" onClick={() => pgnGoTo(pgnIdx + 1)} disabled={pgnIdx === pgnFens.length - 1} title="Next (→)">▶</button>
              <button className="cp-pgn-nav-btn" onClick={() => pgnGoTo(pgnFens.length - 1)} disabled={pgnIdx === pgnFens.length - 1} title="Last move">⏭</button>
            </div>
          )}
        </div>

        {/* Panel */}
        <div className="cp-panel">
          {/* PGN: game info + move list */}
          {mode === 'pgn' && pgnFens.length > 0 && (
            <>
              {(pgnHeaders.White || pgnHeaders.Black) && (
                <div className="cp-game-info">
                  <span className="cp-game-player cp-game-white">
                    <span className="cp-game-dot cp-white" />
                    {pgnHeaders.White || '?'}
                  </span>
                  <span className="cp-game-vs">vs</span>
                  <span className="cp-game-player cp-game-black">
                    <span className="cp-game-dot cp-black" />
                    {pgnHeaders.Black || '?'}
                  </span>
                  {pgnHeaders.Result && (
                    <span className="cp-game-result">{pgnHeaders.Result}</span>
                  )}
                </div>
              )}
              <div className="cp-move-list" ref={moveListRef}>
                <span
                  className={`cp-ml-start ${pgnIdx === 0 ? 'cp-ml-active' : ''}`}
                  onClick={() => pgnGoTo(0)}
                >
                  Start
                </span>
                {pgnMoves.map((san, i) => {
                  const isWhiteMove = i % 2 === 0;
                  const isActive = pgnIdx === i + 1;
                  return (
                    <React.Fragment key={i}>
                      {isWhiteMove && (
                        <span className="cp-ml-num">{Math.floor(i / 2) + 1}.</span>
                      )}
                      <span
                        className={`cp-ml-move ${isActive ? 'cp-ml-active' : ''}`}
                        onClick={() => pgnGoTo(i + 1)}
                      >
                        {san}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}

          <OpeningBadge opening={detectOpeningByMoves(activeHistory)} />

          {/* Engine lines */}
          <div className="cp-eval-card">
            <div className="cp-eval-header">
              <span className="cp-eval-title">⚡ Stockfish 18</span>
              <div className="cp-eval-meta">
                {sfInfo.depth > 0 && <span>depth {sfInfo.depth}</span>}
                {bestSan && (
                  <button className="cp-best-move-btn" onClick={playBestMove}>
                    Best: <strong>{bestSan}</strong>
                  </button>
                )}
              </div>
            </div>
            <div className="cp-pv-list">
              {[0,1,2,3].map(i => (
                <PVLine key={i} line={lines[i]} fen={activeFen} lineNum={i+1} isWhiteTurn={isWhiteTurn} />
              ))}
            </div>
          </div>

          {/* Controls */}
          {mode === 'position' && (
            <div className="cp-controls">
              <button className="cp-ctrl-btn" onClick={goBack} disabled={sanHistory.length === 0}>
                ← Undo
              </button>
              <button className="cp-ctrl-btn" onClick={() => loadFen(STARTING_FEN)}>
                Reset
              </button>
            </div>
          )}

          {/* Turn indicator */}
          <div className="cp-turn">
            <div className={`cp-turn-dot ${isWhiteTurn ? 'cp-white' : 'cp-black'}`} />
            {isWhiteTurn ? 'White' : 'Black'} to move
          </div>
        </div>
      </div>
    </div>
  );
}
