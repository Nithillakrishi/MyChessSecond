import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpeningByMoves } from '../utils/openingDetector';
import './ChessExplorer.css';
import { CHESS_PIECES } from './boardPieces';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function useEval() {
  const engRef      = useRef(null);
  const readyRef    = useRef(false);
  const isSearchRef = useRef(false);
  const stoppingRef = useRef(false);
  const nextFenRef  = useRef(null);
  const [sfScore, setSfScore]     = React.useState(0);
  const [sfReady, setSfReady]     = React.useState(false);
  const [topLines, setTopLines]   = React.useState([]);
  const linesRef = useRef({});

  useEffect(() => {
    const eng = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engRef.current = eng;
    eng.onerror = (e) => { console.warn('Stockfish worker error:', e); };
    eng.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);

      if (line === 'readyok') {
        readyRef.current = true;
        setSfReady(true);
        if (nextFenRef.current) {
          eng.postMessage(`position fen ${nextFenRef.current}`);
          eng.postMessage('go depth 18');
          isSearchRef.current = true;
          nextFenRef.current = null;
          stoppingRef.current = false;
        }
        return;
      }

      if (line.startsWith('bestmove')) {
        isSearchRef.current = false;
        stoppingRef.current = false;
        if (nextFenRef.current) {
          linesRef.current = {};
          eng.postMessage(`position fen ${nextFenRef.current}`);
          eng.postMessage('go depth 18');
          isSearchRef.current = true;
          nextFenRef.current = null;
        }
        return;
      }

      if (stoppingRef.current) return;

      if (line.startsWith('info') && line.includes('multipv')) {
        const mpvM = line.match(/multipv (\d+)/);
        const depthM = line.match(/depth (\d+)/);
        const pvM = line.match(/ pv ([a-h][1-8][a-h][1-8]\S*(?:\s[a-h][1-8][a-h][1-8]\S*)*)/);
        const depth = depthM ? parseInt(depthM[1]) : 0;
        if (depth < 8 || !mpvM || !pvM) return;

        let score = 0;
        if (line.includes('score cp')) {
          const m = line.match(/score cp (-?\d+)/);
          if (m) score = parseInt(m[1]) / 100;
        } else if (line.includes('score mate')) {
          const m = line.match(/score mate (-?\d+)/);
          if (m) score = parseInt(m[1]) > 0 ? 99 : -99;
        }

        const idx = parseInt(mpvM[1]);
        linesRef.current[idx] = { uci: pvM[1].split(' ')[0], score };
        if (idx === 1) setSfScore(score);

        const arr = Object.entries(linesRef.current)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([, v]) => v);
        setTopLines([...arr]);
      }
    };
    eng.postMessage('uci');
    eng.postMessage('setoption name MultiPV value 4');
    eng.postMessage('ucinewgame');
    eng.postMessage('isready');
    return () => { eng.postMessage('quit'); eng.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engRef.current) return;
    linesRef.current = {};
    setTopLines([]);
    if (!readyRef.current) { nextFenRef.current = fen; return; }
    if (isSearchRef.current) {
      nextFenRef.current = fen;
      stoppingRef.current = true;
      engRef.current.postMessage('stop');
    } else {
      engRef.current.postMessage(`position fen ${fen}`);
      engRef.current.postMessage('go depth 18');
      isSearchRef.current = true;
    }
  }, []);

  return { sfScore, sfReady, analyse, topLines };
}

export default function ChessExplorer() {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [game, setGame]             = useState(new Chess());
  const [fen, setFen]               = useState(new Chess().fen());
  const [lastMove, setLastMove]     = useState(null);
  const [moves, setMoves]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [history, setHistory]       = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [flipped, setFlipped]       = useState(false);
  const { sfScore, sfReady, analyse, topLines } = useEval();

  const fetchMoves = useCallback(async (currentFen) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/opening-explorer`, { params: { fen: currentFen } });
      const raw = res.data?.moves || [];
      // Sort by volume (winrate * implied games; we use score field unavailable so sort by rank then winrate)
      // ChessDB doesn't give total volume directly — we sort by rank desc then winrate desc
      const sorted = [...raw].sort((a, b) => {
        if (b.rank !== a.rank) return b.rank - a.rank;
        return b.winrate - a.winrate;
      });
      setMoves(sorted);
    } catch {
      setMoves([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMoves(new Chess().fen());
    analyse(new Chess().fen());
  }, []); // eslint-disable-line

  function applyHistory(sans) {
    const g = new Chess();
    for (const san of sans) { try { g.move(san); } catch {} }
    return g;
  }

  function commitMove(g, m, newHistory) {
    setGame(g);
    setFen(g.fen());
    setLastMove({ from: m.from, to: m.to });
    setHistory(newHistory);
    setSelectedSquare(null);
    fetchMoves(g.fen());
    analyse(g.fen());
  }

  function navigate(uciOrSan) {
    const g = new Chess(game.fen());
    let m;
    try {
      if (uciOrSan.length >= 4 && uciOrSan[0].match(/[a-h]/) && uciOrSan[2].match(/[a-h]/)) {
        m = g.move({ from: uciOrSan.slice(0,2), to: uciOrSan.slice(2,4), promotion: uciOrSan[4] || 'q' });
      } else {
        m = g.move(uciOrSan);
      }
    } catch { return; }
    if (!m) return;
    commitMove(g, m, [...history, m.san]);
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
    fetchMoves(g.fen()); analyse(g.fen());
  }

  function reset() {
    const g = new Chess();
    setGame(g); setFen(g.fen()); setLastMove(null);
    setHistory([]); setSelectedSquare(null);
    fetchMoves(g.fen()); analyse(g.fen());
  }

  // Eval bar
  const isWhiteTurn = game.turn() === 'w';
  const displayScore = isWhiteTurn ? sfScore : -sfScore;
  const whitePct = Math.min(90, Math.max(10, 50 + displayScore * 4));

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

  const RANK_SYMBOL = { 2: '★', 1: '●', 0: '▲' };
  const RANK_COLOR  = { 2: 'var(--green)', 1: 'var(--gold)', 0: 'var(--red)' };

  return (
    <div className="ce-root">
      <div className="ce-layout">
        {/* Board column */}
        <div className="ce-board-col">
          {/* Eval bar + board side by side */}
          <div className="ce-board-inner">
            <div className="ce-eval-wrap">
              <div className="ce-eval-bar-outer">
                {flipped ? (
                  <>
                    <div className="ce-eval-white" style={{ height: `${whitePct}%` }} />
                    <div className="ce-eval-black" style={{ height: `${100 - whitePct}%` }} />
                  </>
                ) : (
                  <>
                    <div className="ce-eval-black" style={{ height: `${100 - whitePct}%` }} />
                    <div className="ce-eval-white" style={{ height: `${whitePct}%` }} />
                  </>
                )}
              </div>
              <div className="ce-eval-score-badge">
                {sfReady ? (displayScore >= 0 ? '+' : '') + displayScore.toFixed(2) : '—'}
              </div>
            </div>

            <div className="ce-board-wrap">
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
          <div className="ce-history">
            {history.length === 0
              ? <span className="ce-history-empty">Play a move or click an explorer move</span>
              : history.map((m, i) => (
                  <span key={i} className="ce-hist-move">
                    {i % 2 === 0 && <span className="ce-hist-num">{Math.floor(i/2)+1}.</span>}
                    {m}
                  </span>
                ))}
          </div>

          <div className="ce-controls">
            <button className="ce-ctrl-btn" onClick={goBack} disabled={history.length === 0}>← Back</button>
            <button className="ce-ctrl-btn" onClick={reset}>Reset</button>
            <button className="ce-ctrl-btn ce-ctrl-flip" onClick={() => setFlipped(f => !f)} title="Flip board">⇅</button>
          </div>
        </div>

        {/* Explorer panel */}
        <div className="ce-panel">
          {/* Header */}
          <div className="ce-panel-header">
            <span className="ce-panel-title">Opening Explorer</span>
            {loading && <span className="ce-loading">loading…</span>}
            <div className="ce-eval-badge">
              {sfReady ? (displayScore >= 0 ? '+' : '') + displayScore.toFixed(2) : '—'}
            </div>
          </div>

          {/* Engine lines — 4 chips in a 2x2 grid */}
          <div className="ce-sf-grid">
            <div className="ce-sf-grid-label">
              <span>⚡ Engine</span>
              <span className="ce-sf-grid-sub">{sfReady ? '' : 'loading…'}</span>
            </div>
            <div className="ce-sf-chips">
              {topLines.length === 0
                ? [1,2,3,4].map(i => <div key={i} className="ce-sf-chip ce-sf-chip-skeleton" />)
                : topLines.slice(0, 4).map((ln, i) => {
                    let san = ln.uci;
                    try {
                      const tmp = new Chess(fen);
                      const r = tmp.move({ from: ln.uci.slice(0,2), to: ln.uci.slice(2,4), promotion: ln.uci[4] || 'q' });
                      if (r) san = r.san;
                    } catch {}
                    const scoreStr = ln.score >= 99 ? '#' : ln.score <= -99 ? '-#'
                      : (ln.score >= 0 ? '+' : '') + ln.score.toFixed(2);
                    const CHIP_COLORS = ['#a78bfa', '#34d399', '#fbbf24', '#60a5fa'];
                    const col = CHIP_COLORS[i];
                    return (
                      <button key={i} className="ce-sf-chip" onClick={() => navigate(ln.uci)}
                        style={{ '--chip-color': col }}>
                        <span className="ce-sf-chip-san">{san}</span>
                        <span className="ce-sf-chip-score">{scoreStr}</span>
                      </button>
                    );
                  })}
            </div>
          </div>

          {/* Divider + DB section label */}
          <div className="ce-db-label">
            <span>🌐 ChessDB</span>
            <span className="ce-db-sub">click any move to navigate</span>
          </div>

          {/* Column headers */}
          <div className="ce-col-headers">
            <span className="ce-col-move">Move</span>
            <span className="ce-col-rank">Quality</span>
            <span className="ce-col-wr">Win %</span>
            <span className="ce-col-bar"></span>
          </div>

          <div className="ce-moves-list">
            {moves.length === 0 && !loading && (
              <div className="ce-no-moves">No data for this position in ChessDB.</div>
            )}
            {moves.slice(0, 7).map((mv, i) => {
              const wr = mv.winrate != null ? Math.round(mv.winrate) : null;
              return (
                <button key={i} className="ce-move-row" onClick={() => navigate(mv.uci || mv.san)}>
                  <span className="ce-move-san">{mv.san}</span>
                  <span className="ce-move-rank" style={{ color: RANK_COLOR[mv.rank] ?? 'var(--muted)' }}>
                    {RANK_SYMBOL[mv.rank] ?? '●'} {mv.rank_label}
                  </span>
                  <span className="ce-move-wr" style={{ color: wr > 50 ? 'var(--green)' : wr < 45 ? 'var(--red)' : 'var(--gold)' }}>
                    {wr != null ? `${wr}%` : '—'}
                  </span>
                  <div className="ce-move-bar-wrap">
                    <div className="ce-move-bar" style={{ width: `${wr ?? 50}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
