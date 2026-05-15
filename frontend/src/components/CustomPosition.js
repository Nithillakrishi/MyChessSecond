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
  { label: 'Sicilian (1.e4 c5)', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2' },
  { label: "Queen's Gambit", fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2' },
  { label: "King's Indian", fen: 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 7' },
  { label: 'Rook vs King', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' },
];

// ── Stockfish hook ──────────────────────────────────────────────────────────
function useStockfishAnalyser() {
  const engineRef   = useRef(null);
  const nextFenRef  = useRef(null);
  const stoppingRef = useRef(false);
  const isReadyRef  = useRef(false);
  const isSearchRef = useRef(false);
  const [sfInfo, setSfInfo] = useState({ score: 0, type: 'cp', depth: 0, bestMove: null, ready: false });
  const [lines, setLines] = useState([null, null, null, null]);

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;
    engine.onerror = (e) => { console.warn('Stockfish worker error:', e); };

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
        if (nextFenRef.current) { const f = nextFenRef.current; nextFenRef.current = null; startSearch(f); }
        return;
      }

      if (msg.startsWith('bestmove')) {
        isSearchRef.current = false;
        stoppingRef.current = false;
        const bm = msg.match(/bestmove (\S+)/);
        if (bm && bm[1] !== '(none)') setSfInfo(p => ({ ...p, bestMove: bm[1] }));
        if (nextFenRef.current) { const f = nextFenRef.current; nextFenRef.current = null; startSearch(f); }
        return;
      }

      if (stoppingRef.current) return;

      if (msg.startsWith('info') && msg.includes('multipv')) {
        const pvM = msg.match(/multipv (\d+)/);
        const cpM = msg.match(/score cp (-?\d+)/);
        const mateM = msg.match(/score mate (-?\d+)/);
        const depM = msg.match(/\bdepth (\d+)/);
        const pvIdx = msg.indexOf(' pv ');
        if (!pvM) return;
        const n = parseInt(pvM[1]);
        const depth = depM ? parseInt(depM[1]) : 0;
        if (depth < 6) return;
        let evalScore = null;
        if (cpM) evalScore = parseInt(cpM[1]) / 100;
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
    if (!isReadyRef.current) { nextFenRef.current = fen; return; }
    if (isSearchRef.current) {
      nextFenRef.current = fen;
      stoppingRef.current = true;
      engineRef.current.postMessage('stop');
    } else {
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage('go depth 22');
      isSearchRef.current = true;
    }
  }, []);

  return { sfInfo, lines, analyse };
}

// ── PV line display ─────────────────────────────────────────────────────────
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
  const evalStr = adj == null ? '—' : adj >= 99 ? 'M' : adj <= -99 ? '-M' : (adj >= 0 ? `+${adj.toFixed(2)}` : adj.toFixed(2));
  const cls = adj == null ? '' : adj > 0.3 ? 'cp-pv-pos' : adj < -0.3 ? 'cp-pv-neg' : 'cp-pv-neu';
  const sans = [];
  try {
    const g = new Chess(fen);
    let moveNum = g.moveNumber();
    let firstBlack = g.turn() === 'b';
    for (const uci of pvMoves.slice(0, 7)) {
      const r = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
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

// ── Game tree helpers ───────────────────────────────────────────────────────
let _nid = 0;
const mkId = () => `n${++_nid}`;

function buildTree(pgnText) {
  const g = new Chess();
  g.loadPgn(pgnText.trim());
  const headers = g.header();
  const history = g.history({ verbose: true });

  const rootId = mkId();
  const g2 = new Chess();
  const nodes = { [rootId]: { id: rootId, fen: g2.fen(), san: null, uci: null, parentId: null, childIds: [] } };

  let prevId = rootId;
  for (const m of history) {
    g2.move(m.san);
    const id = mkId();
    nodes[id] = { id, fen: g2.fen(), san: m.san, uci: m.from + m.to + (m.promotion || ''), parentId: prevId, childIds: [] };
    nodes[prevId].childIds.push(id);
    prevId = id;
  }
  return { nodes, rootId, headers };
}

function treeAddMove(nodes, parentId, fen, san, uci) {
  const parent = nodes[parentId];
  const existing = parent.childIds.find(cId => nodes[cId]?.san === san);
  if (existing) return { nodes, newId: existing };
  const id = mkId();
  return {
    nodes: {
      ...nodes,
      [parentId]: { ...parent, childIds: [...parent.childIds, id] },
      [id]: { id, fen, san, uci, parentId, childIds: [] },
    },
    newId: id,
  };
}

function getPathSans(nodes, nodeId) {
  const path = [];
  let cur = nodeId;
  while (cur && nodes[cur]?.parentId !== null) {
    if (nodes[cur]?.san) path.unshift(nodes[cur].san);
    cur = nodes[cur]?.parentId;
  }
  return path;
}

// Render game tree as React elements (inline with variations in parentheses)
function buildTreeTokens(nodes, rootId, currentId, onNavigate) {
  const tokens = [];
  const rootChess = (() => { try { return new Chess(nodes[rootId]?.fen || STARTING_FEN); } catch { return new Chess(); } })();

  function renderLine(nodeId, moveNum, isWhite, arr, needsNum) {
    const node = nodes[nodeId];
    if (!node || node.childIds.length === 0) return;
    const [mainId, ...varIds] = node.childIds;
    const mainNode = nodes[mainId];

    if (isWhite || needsNum) {
      arr.push(<span key={`mn-${mainId}`} className="cp-ml-num">{moveNum}{isWhite ? '.' : '…'} </span>);
    }
    arr.push(
      <span key={mainId} data-id={mainId}
        className={`cp-ml-move${mainId === currentId ? ' cp-ml-active' : ''}`}
        onClick={() => onNavigate(mainId)}
      >{mainNode.san}</span>
    );
    arr.push(' ');

    varIds.forEach(varId => {
      const varNode = nodes[varId];
      const vt = [];
      vt.push(<span key={`vmn-${varId}`} className="cp-ml-num">{moveNum}{isWhite ? '.' : '…'} </span>);
      vt.push(
        <span key={varId} data-id={varId}
          className={`cp-ml-move${varId === currentId ? ' cp-ml-active' : ''}`}
          onClick={() => onNavigate(varId)}
        >{varNode.san}</span>
      );
      vt.push(' ');
      renderLine(varId, isWhite ? moveNum : moveNum + 1, !isWhite, vt, false);
      arr.push(<span key={`vw-${varId}`} className="cp-variation">({vt}) </span>);
    });

    const hasVars = varIds.length > 0;
    renderLine(mainId, isWhite ? moveNum : moveNum + 1, !isWhite, arr, hasVars && isWhite);
  }

  renderLine(rootId, rootChess.moveNumber(), rootChess.turn() === 'w', tokens, false);
  return tokens;
}

// ── Main component ──────────────────────────────────────────────────────────
export default function CustomPosition() {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [mode, setMode] = useState('position');
  const [boardFlipped, setBoardFlipped] = useState(false);

  // position mode
  const [fenInput, setFenInput] = useState(STARTING_FEN);
  const [fenError, setFenError] = useState('');
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(STARTING_FEN);
  const [sanHistory, setSanHistory] = useState([]);
  const startFenRef = useRef(STARTING_FEN);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [lastMove, setLastMove] = useState(null);

  // pgn mode — game tree
  const [pgnInput, setPgnInput] = useState('');
  const [pgnError, setPgnError] = useState('');
  const [pgnHeaders, setPgnHeaders] = useState({});
  const [nodes, setNodes] = useState({});
  const [rootId, setRootId] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [pgnSel, setPgnSel] = useState(null); // click-to-move selection
  const moveListRef = useRef(null);
  // refs for keyboard handler (avoids stale closures)
  const nodesRef = useRef({});
  const currentIdRef = useRef(null);

  const { sfInfo, lines, analyse } = useStockfishAnalyser();

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  // === Position mode =========================================================
  const loadFen = useCallback((f) => {
    try {
      const g = new Chess(f.trim());
      setGame(g); setFen(g.fen()); setFenInput(g.fen());
      startFenRef.current = g.fen();
      setFenError(''); setLastMove(null); setSanHistory([]); setSelectedSquare(null);
      analyse(g.fen());
    } catch { setFenError('Invalid FEN. Please check and try again.'); }
  }, [analyse]);

  useEffect(() => { analyse(STARTING_FEN); }, []); // eslint-disable-line

  function commitMove(g, move, newHistory) {
    setGame(g); setFen(g.fen()); setFenInput(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setFenError(''); setSanHistory(newHistory); setSelectedSquare(null);
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

  function goBack() {
    setSanHistory(prev => {
      if (prev.length === 0) return prev;
      const h = prev.slice(0, -1);
      const base = new Chess(startFenRef.current);
      for (const san of h) { try { base.move(san); } catch {} }
      setGame(base); setFen(base.fen()); setFenInput(base.fen());
      setLastMove(null); setSelectedSquare(null);
      analyse(base.fen());
      return h;
    });
  }

  // === PGN mode ==============================================================
  function loadPgnGame(text) {
    try {
      const { nodes: n, rootId: r, headers } = buildTree(text);
      setNodes(n); setRootId(r); setCurrentId(r);
      setPgnHeaders(headers); setPgnError(''); setPgnSel(null);
      analyse(n[r].fen);
    } catch { setPgnError('Invalid PGN. Please check format and try again.'); }
  }

  function navigateTo(id) {
    if (!nodes[id]) return;
    setCurrentId(id); setPgnSel(null);
    analyse(nodes[id].fen);
  }

  // Navigation using refs — safe in event handlers
  function navBack() {
    const p = nodesRef.current[currentIdRef.current]?.parentId;
    if (p) { setCurrentId(p); setPgnSel(null); analyse(nodesRef.current[p].fen); }
  }
  function navForward() {
    const first = nodesRef.current[currentIdRef.current]?.childIds[0];
    if (first) { setCurrentId(first); setPgnSel(null); analyse(nodesRef.current[first].fen); }
  }
  function navFirst() { if (rootId) navigateTo(rootId); }
  function navLast() {
    if (!rootId) return;
    let id = rootId;
    while (nodesRef.current[id]?.childIds.length > 0) id = nodesRef.current[id].childIds[0];
    navigateTo(id);
  }

  // Interactive board — makes move, creates variation if diverges from main line
  function onDropPgn(from, to) {
    const curNode = nodesRef.current[currentIdRef.current];
    if (!curNode) return false;
    const g = new Chess(curNode.fen);
    let move;
    try { move = g.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    const uci = from + to + (move.promotion || '');
    const { nodes: newNodes, newId } = treeAddMove(nodesRef.current, currentIdRef.current, g.fen(), move.san, uci);
    setNodes(newNodes); setCurrentId(newId); setPgnSel(null);
    analyse(g.fen());
    return true;
  }

  function onSquareClickPgn(square) {
    const curNode = nodes[currentId];
    if (!curNode) return;
    const g = (() => { try { return new Chess(curNode.fen); } catch { return null; } })();
    if (!g) return;
    if (pgnSel) {
      let move;
      try { move = g.move({ from: pgnSel, to: square, promotion: 'q' }); } catch {}
      if (move) {
        const uci = pgnSel + square + (move.promotion || '');
        const { nodes: newNodes, newId } = treeAddMove(nodes, currentId, g.fen(), move.san, uci);
        setNodes(newNodes); setCurrentId(newId); setPgnSel(null);
        analyse(g.fen()); return;
      }
      const piece = g.get(square);
      if (piece && piece.color === g.turn()) setPgnSel(square); else setPgnSel(null);
    } else {
      const piece = g.get(square);
      if (piece && piece.color === g.turn()) setPgnSel(square);
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (mode !== 'pgn') return;
    const handle = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') navBack();
      else if (e.key === 'ArrowRight') navForward();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [mode]); // navBack/Forward use refs — stable

  // Auto-scroll move list
  useEffect(() => {
    if (!moveListRef.current || !currentId) return;
    const el = moveListRef.current.querySelector(`[data-id="${currentId}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentId]);

  // Play best move (works in both modes)
  function playBestMove() {
    if (!sfInfo.bestMove) return;
    const curFen = mode === 'pgn' ? nodes[currentId]?.fen : fen;
    if (!curFen) return;
    const g = new Chess(curFen);
    const m = g.move({ from: sfInfo.bestMove.slice(0, 2), to: sfInfo.bestMove.slice(2, 4), promotion: sfInfo.bestMove[4] || 'q' });
    if (!m) return;
    if (mode === 'pgn') {
      const { nodes: n2, newId } = treeAddMove(nodes, currentId, g.fen(), m.san, sfInfo.bestMove);
      setNodes(n2); setCurrentId(newId); analyse(g.fen());
    } else {
      setGame(g); setFen(g.fen()); setFenInput(g.fen());
      setLastMove({ from: m.from, to: m.to });
      setSanHistory(h => [...h, m.san]); analyse(g.fen());
    }
  }

  // === Derived values ========================================================
  const activeFen = mode === 'pgn' ? (nodes[currentId]?.fen || STARTING_FEN) : fen;
  const activeHistory = mode === 'pgn' ? getPathSans(nodes, currentId) : sanHistory;
  const activeGame = (() => { try { return new Chess(activeFen); } catch { return new Chess(); } })();
  const isWhiteTurn = activeGame.turn() === 'w';
  const evalVal = evalLabel(sfInfo, isWhiteTurn);
  const bestSan = uciToSan(activeFen, sfInfo.bestMove);
  const boardSize = Math.min(500, Math.max(300, window.innerWidth - 420));

  // Last move highlight
  const activeSel = mode === 'pgn' ? pgnSel : selectedSquare;
  const activeLast = mode === 'pgn'
    ? (() => { const u = nodes[currentId]?.uci; return u ? { from: u.slice(0, 2), to: u.slice(2, 4) } : null; })()
    : lastMove;

  const legalDots = {};
  if (activeSel) {
    activeGame.moves({ square: activeSel, verbose: true }).forEach(m => {
      legalDots[m.to] = {
        background: activeGame.get(m.to)
          ? 'radial-gradient(circle, rgba(0,0,0,.35) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.25) 30%, transparent 30%)',
        borderRadius: '50%',
      };
    });
  }

  const customSquareStyles = {
    ...(activeLast ? {
      [activeLast.from]: { background: 'rgba(229,139,0,0.35)' },
      [activeLast.to]:   { background: 'rgba(229,139,0,0.45)' },
    } : {}),
    ...(activeSel ? { [activeSel]: { background: 'rgba(255,215,0,0.55)' } } : {}),
    ...legalDots,
  };

  const atStart = !currentId || nodes[currentId]?.parentId === null;
  const atEnd   = !currentId || (nodes[currentId]?.childIds.length === 0);
  const treeTokens = (mode === 'pgn' && rootId && currentId)
    ? buildTreeTokens(nodes, rootId, currentId, navigateTo) : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="cp-root">
      {/* Mode tabs */}
      <div className="cp-mode-tabs">
        <button className={`cp-mode-tab${mode === 'position' ? ' cp-mode-tab-active' : ''}`} onClick={() => setMode('position')}>
          Import FEN
        </button>
        <button className={`cp-mode-tab${mode === 'pgn' ? ' cp-mode-tab-active' : ''}`} onClick={() => setMode('pgn')}>
          Import PGN
        </button>
      </div>

      {/* FEN input */}
      {mode === 'position' && (
        <div className="cp-fen-bar">
          <div className="cp-fen-input-wrap">
            <input
              className={`cp-fen-input${fenError ? ' cp-fen-error' : ''}`}
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
              <button key={ex.label} className="cp-example-chip" onClick={() => loadFen(ex.fen)}>{ex.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* PGN input */}
      {mode === 'pgn' && (
        <div className="cp-pgn-bar">
          <div className="cp-pgn-input-wrap">
            <textarea
              className={`cp-pgn-textarea${pgnError ? ' cp-fen-error' : ''}`}
              value={pgnInput}
              onChange={e => setPgnInput(e.target.value)}
              placeholder="Paste PGN here… (Chess.com, Lichess, or any PGN export)"
              spellCheck={false}
              rows={3}
            />
            <button className="cp-load-btn" style={{ alignSelf: 'flex-end' }} onClick={() => loadPgnGame(pgnInput)}>Load</button>
          </div>
          {pgnError && <span className="cp-fen-err-msg">{pgnError}</span>}
        </div>
      )}

      {/* Main layout */}
      <div className="cp-layout">
        {/* Board column */}
        <div className="cp-board-col">
          {/* Eval bar + board side by side */}
          <div className="cp-board-row">
            <div className="cp-eval-bar-wrap">
              <div className="cp-eval-bar-outer" style={{ height: boardSize }}>
                <div className="cp-eval-bar-black" style={{ height: `${Math.min(90, Math.max(10, 50 - (isWhiteTurn ? sfInfo.score : -sfInfo.score) * 4))}%` }} />
                <div className="cp-eval-bar-white" style={{ height: `${Math.min(90, Math.max(10, 50 + (isWhiteTurn ? sfInfo.score : -sfInfo.score) * 4))}%` }} />
              </div>
              <div className="cp-eval-score-badge">{sfInfo.ready ? evalVal : '—'}</div>
            </div>
            <div className="cp-board-wrap" style={{ width: boardSize }}>
              <Chessboard
                customPieces={CHESS_PIECES}
                position={activeFen}
                onPieceDrop={mode === 'pgn' ? onDropPgn : onDrop}
                onSquareClick={mode === 'pgn' ? onSquareClickPgn : onSquareClick}
                boardOrientation={boardFlipped ? 'black' : 'white'}
                boardWidth={boardSize}
                customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
                customDarkSquareStyle={{ backgroundColor: boardDark }}
                customLightSquareStyle={{ backgroundColor: boardLight }}
                customSquareStyles={customSquareStyles}
              />
            </div>
          </div>

          {/* Controls below board */}
          {mode === 'pgn' && rootId && (
            <div className="cp-pgn-nav">
              <button className="cp-pgn-nav-btn" onClick={navFirst} disabled={atStart}>⏮</button>
              <button className="cp-pgn-nav-btn" onClick={navBack}  disabled={atStart}>◀</button>
              <span className="cp-pgn-pos-label">
                {atStart ? 'Start' : (nodes[currentId]?.san || '')}
              </span>
              <button className="cp-pgn-nav-btn" onClick={navForward} disabled={atEnd}>▶</button>
              <button className="cp-pgn-nav-btn" onClick={navLast}    disabled={atEnd}>⏭</button>
              <button className="cp-pgn-nav-btn cp-flip-btn" onClick={() => setBoardFlipped(f => !f)} title="Flip board">⇅</button>
            </div>
          )}
          {mode === 'position' && (
            <div className="cp-controls">
              <button className="cp-ctrl-btn" onClick={goBack} disabled={sanHistory.length === 0}>← Undo</button>
              <button className="cp-ctrl-btn" onClick={() => loadFen(STARTING_FEN)}>Reset</button>
              <button className="cp-ctrl-btn cp-flip-btn" onClick={() => setBoardFlipped(f => !f)} title="Flip board">⇅ Flip</button>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="cp-panel">
          {/* Game header */}
          {mode === 'pgn' && (pgnHeaders.White || pgnHeaders.Black) && (
            <div className="cp-game-info">
              <span className="cp-game-player">
                <span className="cp-game-dot cp-white" />
                {pgnHeaders.White || '?'}
                {pgnHeaders.WhiteElo && <span className="cp-game-elo">{pgnHeaders.WhiteElo}</span>}
              </span>
              <span className="cp-game-vs">vs</span>
              <span className="cp-game-player">
                <span className="cp-game-dot cp-black" />
                {pgnHeaders.Black || '?'}
                {pgnHeaders.BlackElo && <span className="cp-game-elo">{pgnHeaders.BlackElo}</span>}
              </span>
              {pgnHeaders.Result && <span className="cp-game-result">{pgnHeaders.Result}</span>}
            </div>
          )}

          {/* Move tree */}
          {mode === 'pgn' && rootId && (
            <div className="cp-move-list" ref={moveListRef}>
              <span
                data-id={rootId}
                className={`cp-ml-start${currentId === rootId ? ' cp-ml-active' : ''}`}
                onClick={() => navigateTo(rootId)}
              >Start </span>
              {treeTokens}
            </div>
          )}

          <OpeningBadge opening={detectOpeningByMoves(activeHistory)} />

          {/* Engine analysis */}
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
              {[0, 1, 2, 3].map(i => (
                <PVLine key={i} line={lines[i]} fen={activeFen} lineNum={i + 1} isWhiteTurn={isWhiteTurn} />
              ))}
            </div>
          </div>

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
