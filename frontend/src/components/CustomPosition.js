import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import axios from 'axios';
import { useBoardColors } from '../contexts/ThemeContext';
import './CustomPosition.css';

const API_BASE = 'http://localhost:8000';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const EXAMPLE_FENS = [
  { label: 'Starting position', fen: STARTING_FEN },
  { label: "Sicilian (after 1.e4 c5)", fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2' },
  { label: "Queen's Gambit", fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2' },
  { label: 'King\'s Indian (classical)', fen: 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 7' },
  { label: 'Endgame — Rook vs King', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' },
];

function useStockfishAnalyser() {
  const engineRef = useRef(null);
  const [sfInfo, setSfInfo] = useState({ score: 0, type: 'cp', depth: 0, bestMove: null, ready: false, pv: [] });

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;

    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line === 'readyok') { setSfInfo(p => ({ ...p, ready: true })); return; }

      if (line.startsWith('info') && line.includes('score')) {
        const cpMatch    = line.match(/score cp (-?\d+)/);
        const mateMatch  = line.match(/score mate (-?\d+)/);
        const depthMatch = line.match(/\bdepth (\d+)/);
        const pvMatch    = line.match(/ pv (.+)/);
        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
        const pvMoves = pvMatch ? pvMatch[1].split(' ').slice(0, 5) : [];

        if (mateMatch) {
          setSfInfo(p => ({ ...p, score: parseInt(mateMatch[1]), type: 'mate', depth, pv: pvMoves }));
        } else if (cpMatch) {
          setSfInfo(p => ({ ...p, score: parseInt(cpMatch[1]) / 100, type: 'cp', depth, pv: pvMoves }));
        }
      }

      if (line.startsWith('bestmove')) {
        const m = line.match(/bestmove (\S+)/);
        if (m && m[1] !== '(none)') setSfInfo(p => ({ ...p, bestMove: m[1] }));
      }
    };

    engine.postMessage('uci');
    engine.postMessage('ucinewgame');
    engine.postMessage('isready');

    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  const analyse = useCallback((fen) => {
    if (!engineRef.current) return;
    engineRef.current.postMessage('stop');
    engineRef.current.postMessage(`position fen ${fen}`);
    engineRef.current.postMessage('go depth 20');
    setSfInfo(p => ({ ...p, bestMove: null, depth: 0, pv: [] }));
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.postMessage('stop');
  }, []);

  return { sfInfo, analyse, stop };
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
  const [fenInput, setFenInput] = useState(STARTING_FEN);
  const [fenError, setFenError]  = useState('');
  const [game, setGame]           = useState(new Chess());
  const [fen, setFen]             = useState(STARTING_FEN);
  const [lastMove, setLastMove]   = useState(null);
  const [explorerMoves, setExplorerMoves] = useState([]);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const { sfInfo, analyse } = useStockfishAnalyser();

  const loadFen = useCallback((f) => {
    try {
      const g = new Chess(f.trim());
      setGame(g);
      setFen(g.fen());
      setFenInput(g.fen());
      setFenError('');
      setLastMove(null);
      setExplorerMoves([]);
      analyse(g.fen());
      fetchExplorer(g.fen());
    } catch {
      setFenError('Invalid FEN string. Please check and try again.');
    }
  }, [analyse]);

  const fetchExplorer = async (currentFen) => {
    setExplorerLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/opening-explorer`, { params: { fen: currentFen } });
      setExplorerMoves(res.data?.moves || []);
    } catch {
      setExplorerMoves([]);
    } finally {
      setExplorerLoading(false);
    }
  };

  useEffect(() => {
    analyse(STARTING_FEN);
    fetchExplorer(STARTING_FEN);
  }, []); // eslint-disable-line

  function onDrop(from, to, piece) {
    const g = new Chess(game.fen());
    const move = g.move({ from, to, promotion: piece?.slice(-1)?.toLowerCase() || 'q' });
    if (!move) return false;
    setGame(g);
    setFen(g.fen());
    setFenInput(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setFenError('');
    setExplorerMoves([]);
    analyse(g.fen());
    fetchExplorer(g.fen());
    return true;
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
    setExplorerMoves([]);
    analyse(g.fen());
    fetchExplorer(g.fen());
  }

  function playExplorerMove(uciMove) {
    if (!uciMove) return;
    const g = new Chess(game.fen());
    let m;
    if (uciMove.length >= 4 && uciMove[0].match(/[a-h]/) && uciMove[2].match(/[a-h]/)) {
      // UCI move
      m = g.move({ from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] || 'q' });
    } else {
      // SAN move
      try { m = g.move(uciMove); } catch { return; }
    }
    if (!m) return;
    setGame(g);
    setFen(g.fen());
    setFenInput(g.fen());
    setLastMove({ from: m.from, to: m.to });
    setExplorerMoves([]);
    analyse(g.fen());
    fetchExplorer(g.fen());
  }

  function goBack() {
    const g = new Chess(game.fen());
    g.undo();
    setGame(g);
    setFen(g.fen());
    setFenInput(g.fen());
    setLastMove(null);
    setExplorerMoves([]);
    analyse(g.fen());
    fetchExplorer(g.fen());
  }

  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(229,139,0,0.35)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(229,139,0,0.45)' };
  }

  const isWhiteTurn = game.turn() === 'w';
  const evalVal = evalLabel(sfInfo, isWhiteTurn);
  const evalPositive = sfInfo.type === 'mate' ? sfInfo.score > 0 : sfInfo.score >= 0;
  const bestSan = uciToSan(fen, sfInfo.bestMove);

  return (
    <div className="cp-root">
      {/* FEN bar */}
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

      {/* Main layout */}
      <div className="cp-layout">
        {/* Board */}
        <div className="cp-board-col">
          <div className="cp-eval-bar-wrap">
            <div className="cp-eval-bar-outer">
              <div
                className="cp-eval-bar-fill"
                style={{ height: `${Math.min(90, Math.max(10, 50 + (sfInfo.score || 0) * 5))}%` }}
              />
            </div>
          </div>
          <div className="cp-board-wrap">
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

        {/* Analysis panel */}
        <div className="cp-panel">
          {/* Eval */}
          <div className="cp-eval-card">
            <div className={`cp-eval-score ${evalPositive ? 'cp-eval-pos' : 'cp-eval-neg'}`}>
              {sfInfo.ready ? evalVal : '—'}
            </div>
            <div className="cp-eval-meta">
              <span>Stockfish 18</span>
              {sfInfo.depth > 0 && <span>depth {sfInfo.depth}</span>}
            </div>

            {bestSan && (
              <button className="cp-best-move-btn" onClick={playBestMove}>
                <span className="cp-bm-label">Best move</span>
                <span className="cp-bm-move">{bestSan}</span>
              </button>
            )}

            {sfInfo.pv && sfInfo.pv.length > 0 && (
              <div className="cp-pv">
                <span className="cp-pv-label">PV:</span>
                {sfInfo.pv.map((m, i) => <span key={i} className="cp-pv-move">{m}</span>)}
              </div>
            )}
          </div>

          {/* Board controls */}
          <div className="cp-controls">
            <button className="cp-ctrl-btn" onClick={goBack} disabled={game.history().length === 0}>
              ← Undo
            </button>
            <button className="cp-ctrl-btn" onClick={() => loadFen(STARTING_FEN)}>
              Reset
            </button>
          </div>

          {/* Explorer */}
          <div className="cp-explorer-card">
            <div className="cp-explorer-title">
              ChessDB Explorer
              {explorerLoading && <span className="cp-explorer-loading">loading…</span>}
            </div>
            {explorerMoves.length > 0 ? (
              <div className="cp-explorer-moves">
                {explorerMoves.slice(0, 8).map((mv, i) => {
                  const wr = mv.winrate != null ? Math.round(mv.winrate) : null;
                  const scoreLabel = mv.score_cp != null
                    ? (mv.score_cp >= 0 ? `+${(mv.score_cp/100).toFixed(1)}` : `${(mv.score_cp/100).toFixed(1)}`)
                    : null;
                  return (
                    <button key={i} className="cp-explorer-row" onClick={() => playExplorerMove(mv.uci || mv.san)}>
                      <span className="cp-ex-move">{mv.san}</span>
                      <span className="cp-ex-games">{mv.rank_label || ''}</span>
                      {wr !== null && (
                        <div className="cp-ex-bar">
                          <div className="cp-ex-bar-fill" style={{ width: `${wr}%` }} />
                        </div>
                      )}
                      {wr !== null && <span className="cp-ex-wr">{wr}%</span>}
                      {scoreLabel && <span className="cp-ex-score">{scoreLabel}</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              !explorerLoading && <p className="cp-no-moves">No explorer data for this position.</p>
            )}
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
