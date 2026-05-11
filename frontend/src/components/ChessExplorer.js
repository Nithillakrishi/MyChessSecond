import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors } from '../contexts/ThemeContext';
import './ChessExplorer.css';

const API_BASE = 'http://localhost:8000';

function useEval() {
  const engRef = useRef(null);
  const [sfScore, setSfScore] = React.useState(0);
  const [sfReady, setSfReady] = React.useState(false);

  useEffect(() => {
    const eng = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engRef.current = eng;
    eng.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line === 'readyok') setSfReady(true);
      if (line.startsWith('info') && line.includes('score cp')) {
        const m = line.match(/score cp (-?\d+)/);
        if (m) setSfScore(parseInt(m[1]) / 100);
      }
      if (line.startsWith('info') && line.includes('score mate')) {
        const m = line.match(/score mate (-?\d+)/);
        if (m) setSfScore(parseInt(m[1]) > 0 ? 99 : -99);
      }
    };
    eng.postMessage('uci');
    eng.postMessage('ucinewgame');
    eng.postMessage('isready');
    return () => { eng.postMessage('quit'); eng.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engRef.current) return;
    engRef.current.postMessage('stop');
    engRef.current.postMessage(`position fen ${fen}`);
    engRef.current.postMessage('go depth 16');
  }, []);

  return { sfScore, sfReady, analyse };
}

export default function ChessExplorer() {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [game, setGame]             = useState(new Chess());
  const [fen, setFen]               = useState(new Chess().fen());
  const [lastMove, setLastMove]     = useState(null);
  const [moves, setMoves]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [history, setHistory]       = useState([]);
  const { sfScore, sfReady, analyse } = useEval();

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

  function navigate(uciOrSan) {
    const g = new Chess(game.fen());
    let m;
    try {
      // Try as SAN first, then UCI
      if (uciOrSan.length >= 4 && uciOrSan[0].match(/[a-h]/) && uciOrSan[2].match(/[a-h]/)) {
        m = g.move({ from: uciOrSan.slice(0,2), to: uciOrSan.slice(2,4), promotion: uciOrSan[4] || 'q' });
      } else {
        m = g.move(uciOrSan);
      }
    } catch { return; }
    if (!m) return;
    setGame(g);
    setFen(g.fen());
    setLastMove({ from: m.from, to: m.to });
    setHistory(prev => [...prev, m.san]);
    fetchMoves(g.fen());
    analyse(g.fen());
  }

  function onDrop(from, to, piece) {
    const g = new Chess(game.fen());
    const m = g.move({ from, to, promotion: piece?.slice(-1)?.toLowerCase() || 'q' });
    if (!m) return false;
    setGame(g);
    setFen(g.fen());
    setLastMove({ from: m.from, to: m.to });
    setHistory(prev => [...prev, m.san]);
    fetchMoves(g.fen());
    analyse(g.fen());
    return true;
  }

  function goBack() {
    const g = new Chess(game.fen());
    g.undo();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setHistory(prev => prev.slice(0, -1));
    fetchMoves(g.fen());
    analyse(g.fen());
  }

  function reset() {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setHistory([]);
    fetchMoves(g.fen());
    analyse(g.fen());
  }

  // Eval bar
  const isWhiteTurn = game.turn() === 'w';
  const displayScore = isWhiteTurn ? sfScore : -sfScore;
  const whitePct = Math.min(90, Math.max(10, 50 + displayScore * 4));

  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(229,139,0,0.35)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(229,139,0,0.45)' };
  }

  const RANK_SYMBOL = { 2: '★', 1: '●', 0: '▲' };
  const RANK_COLOR  = { 2: 'var(--green)', 1: 'var(--gold)', 0: 'var(--red)' };

  return (
    <div className="ce-root">
      <div className="ce-layout">
        {/* Board column */}
        <div className="ce-board-col">
          {/* Eval bar + board side by side */}
          <div className="ce-board-inner">
            <div className="ce-eval-bar-outer">
              <div className="ce-eval-black" style={{ height: `${100 - whitePct}%` }} />
              <div className="ce-eval-white" style={{ height: `${whitePct}%`       }} />
            </div>

            <div className="ce-board-wrap">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                boardOrientation="white"
                customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
                customDarkSquareStyle={{ backgroundColor: boardDark }}
                customLightSquareStyle={{ backgroundColor: boardLight }}
                customSquareStyles={customSquareStyles}
              />
            </div>
          </div>

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
          </div>
        </div>

        {/* Explorer panel */}
        <div className="ce-panel">
          <div className="ce-panel-header">
            <span className="ce-panel-title">ChessDB Opening Explorer</span>
            {loading && <span className="ce-loading">loading…</span>}
            <div className="ce-eval-badge">
              {sfReady ? (displayScore >= 0 ? '+' : '') + displayScore.toFixed(2) : '—'}
            </div>
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
            {moves.map((mv, i) => {
              const wr = mv.winrate != null ? Math.round(mv.winrate) : null;
              const scoreLabel = mv.score_cp != null
                ? (mv.score_cp >= 0 ? `+${(mv.score_cp/100).toFixed(2)}` : `${(mv.score_cp/100).toFixed(2)}`)
                : null;
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
                  {scoreLabel && <span className="ce-move-score">{scoreLabel}</span>}
                </button>
              );
            })}
          </div>

          <div className="ce-source-note">
            Source: ChessDB global database · click any move to navigate
          </div>
        </div>
      </div>
    </div>
  );
}
