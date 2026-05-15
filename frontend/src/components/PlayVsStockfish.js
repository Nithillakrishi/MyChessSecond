import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors } from '../contexts/ThemeContext';
import OpeningBadge from './OpeningBadge';
import { detectOpeningByMoves } from '../utils/openingDetector';
import './PlayVsStockfish.css';
import { CHESS_PIECES } from './boardPieces';

// skillLevel 0-20: Stockfish's built-in blunder mechanism (0 = max blunders)
// movetime in ms: caps search time for consistent strength across positions
const LEVELS = [
  { label: 'Beginner',     skillLevel: 0,  movetime: 50,   elo: '~500'  },
  { label: 'Casual',       skillLevel: 2,  movetime: 150,  elo: '~1000' },
  { label: 'Intermediate', skillLevel: 7,  movetime: 500,  elo: '~1400' },
  { label: 'Advanced',     skillLevel: 14, movetime: 1500, elo: '~1800' },
  { label: 'Master',       skillLevel: 20, movetime: 5000, elo: '~2400' },
];

function parseInfoLine(line) {
  const multipvMatch = line.match(/multipv (\d+)/);
  if (!multipvMatch) return null;
  const cpMatch    = line.match(/score cp (-?\d+)/);
  const mateMatch  = line.match(/score mate (-?\d+)/);
  const pvMatch    = line.match(/ pv (.+)/);
  const depthMatch = line.match(/\bdepth (\d+)/);
  return {
    multipv: parseInt(multipvMatch[1]),
    depth:   depthMatch  ? parseInt(depthMatch[1])   : 0,
    score:   cpMatch     ? parseInt(cpMatch[1]) / 100 : null,
    mate:    mateMatch   ? parseInt(mateMatch[1])     : null,
    isMate:  !!mateMatch,
    pv:      pvMatch     ? pvMatch[1].trim().split(' ') : [],
  };
}

function pvToString(fen, uciMoves, maxMoves = 8) {
  try {
    const g = new Chess(fen);
    let text = '';
    const parts = fen.split(' ');
    let moveNum = parseInt(parts[5]) || 1;
    let isWhite = g.turn() === 'w';
    if (!isWhite) text += `${moveNum}… `;
    for (let i = 0; i < Math.min(uciMoves.length, maxMoves); i++) {
      const uci = uciMoves[i];
      try {
        const mv = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' });
        if (!mv) break;
        if (isWhite) text += `${moveNum}. `;
        text += mv.san + ' ';
        if (!isWhite) moveNum++;
        isWhite = !isWhite;
      } catch { break; }
    }
    return text.trim();
  } catch { return ''; }
}

function useStockfishEngine() {
  const engineRef         = useRef(null);
  const resolveRef        = useRef(null);
  const onAnalysisLineRef = useRef(null);

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;
    engine.onerror = (e) => { console.warn('Stockfish worker error:', e); };
    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      if (line.startsWith('info') && line.includes('depth') && onAnalysisLineRef.current) {
        onAnalysisLineRef.current(line);
        return;
      }
      if (line.startsWith('bestmove') && resolveRef.current) {
        const m = line.match(/bestmove (\S+)/);
        const move = m && m[1] !== '(none)' ? m[1] : null;
        resolveRef.current(move);
        resolveRef.current = null;
      }
    };
    engine.postMessage('uci');
    engine.postMessage('ucinewgame');
    engine.postMessage('isready');
    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  const getBestMove = useCallback((fen, skillLevel, movetime) => {
    return new Promise((resolve) => {
      if (!engineRef.current) { resolve(null); return; }
      resolveRef.current = resolve;
      onAnalysisLineRef.current = null;
      engineRef.current.postMessage('stop');
      engineRef.current.postMessage('setoption name MultiPV value 1');
      engineRef.current.postMessage(`setoption name Skill Level value ${skillLevel}`);
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage(`go movetime ${movetime}`);
    });
  }, []);

  const startAnalysis = useCallback((fen, onLine) => {
    if (!engineRef.current) return;
    onAnalysisLineRef.current = onLine;
    engineRef.current.postMessage('stop');
    engineRef.current.postMessage('setoption name MultiPV value 4');
    engineRef.current.postMessage('setoption name Skill Level value 20');
    engineRef.current.postMessage(`position fen ${fen}`);
    engineRef.current.postMessage('go depth 20');
  }, []);

  const stopAnalysis = useCallback(() => {
    if (!engineRef.current) return;
    onAnalysisLineRef.current = null;
    engineRef.current.postMessage('stop');
  }, []);

  return { getBestMove, startAnalysis, stopAnalysis };
}

export default function PlayVsStockfish() {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [phase,          setPhase]          = useState('setup');
  const [playerColor,    setPlayerColor]    = useState('white');
  const [levelIdx,       setLevelIdx]       = useState(1);
  const [game,           setGame]           = useState(new Chess());
  const [fen,            setFen]            = useState(new Chess().fen());
  const [status,         setStatus]         = useState('');
  const [thinking,       setThinking]       = useState(false);
  const [lastMove,       setLastMove]       = useState(null);
  const [result,         setResult]         = useState(null);
  const [moveHistory,    setMoveHistory]    = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);

  // Post-game analysis state
  const [pvLines,       setPvLines]       = useState([]);
  const [analysisDepth, setAnalysisDepth] = useState(0);
  const [analysisEval,  setAnalysisEval]  = useState(null);
  const [replayIdx,     setReplayIdx]     = useState(0);
  const [exploreGame,   setExploreGame]   = useState(null);
  const [exploreLastMove, setExploreLastMove] = useState(null);
  const [exploreSelected, setExploreSelected] = useState(null);

  // Refs for stable access in closures
  const fenHistoryRef    = useRef([new Chess().fen()]); // FEN after each half-move; [0]=start
  const moveSquaresRef   = useRef([]);                  // {from,to} per half-move (indexed 0..n-1)
  const moveHistoryRef   = useRef([]);
  const moveListRef      = useRef(null);

  moveHistoryRef.current = moveHistory;

  const { getBestMove, startAnalysis, stopAnalysis } = useStockfishEngine();
  const engineColor = playerColor === 'white' ? 'b' : 'w';

  const checkGameOver = useCallback((g) => {
    if (g.isCheckmate()) {
      const winner = g.turn() === 'w' ? 'Black' : 'White';
      return winner === (playerColor === 'white' ? 'White' : 'Black')
        ? { text: 'You win! Checkmate!', type: 'win' }
        : { text: 'Checkmate. Engine wins.', type: 'loss' };
    }
    if (g.isDraw()) {
      let reason = 'Draw';
      if (g.isStalemate())              reason = 'Stalemate';
      else if (g.isThreefoldRepetition()) reason = 'Threefold repetition';
      else if (g.isInsufficientMaterial()) reason = 'Insufficient material';
      return { text: reason, type: 'draw' };
    }
    return null;
  }, [playerColor]);

  // ── Engine move (also records FEN/square history) ───────────────────────────
  const doEngineMove = useCallback(async (currentGame) => {
    setThinking(true);
    const { skillLevel, movetime } = LEVELS[levelIdx];
    const uciMove = await getBestMove(currentGame.fen(), skillLevel, movetime);
    setThinking(false);
    if (!uciMove) return;

    const g = new Chess(currentGame.fen());
    const from  = uciMove.slice(0, 2);
    const to    = uciMove.slice(2, 4);
    const promo = uciMove[4] || 'q';
    const res   = g.move({ from, to, promotion: promo });
    if (!res) return;

    fenHistoryRef.current  = [...fenHistoryRef.current,  g.fen()];
    moveSquaresRef.current = [...moveSquaresRef.current, { from: res.from, to: res.to }];

    setGame(g);
    setFen(g.fen());
    setLastMove({ from: res.from, to: res.to });
    setMoveHistory(prev => [...prev, res.san]);
    setStatus(g.isCheck() ? 'Check!' : '');
    const over = checkGameOver(g);
    if (over) { setResult(over); setPhase('over'); }
  }, [levelIdx, getBestMove, checkGameOver]);

  // Engine turn trigger
  useEffect(() => {
    if (phase !== 'game') return;
    if (game.turn() !== engineColor) return;
    if (game.isGameOver()) return;
    const timer = setTimeout(() => { doEngineMove(game); }, 300);
    return () => clearTimeout(timer);
  }, [phase, game, engineColor, doEngineMove]);

  // Engine plays first when player is black
  useEffect(() => {
    if (phase === 'game' && playerColor === 'black') doEngineMove(new Chess());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Analysis effect: re-runs on navigation or exploration ───────────────────
  useEffect(() => {
    if (phase !== 'over') return;
    const targetFen = exploreGame
      ? exploreGame.fen()
      : (fenHistoryRef.current[replayIdx] ?? new Chess().fen());

    setPvLines([]);
    setAnalysisDepth(0);
    setAnalysisEval(null);

    // Debounce so rapid navigation doesn't hammer the engine
    const timer = setTimeout(() => {
      startAnalysis(targetFen, (line) => {
        const parsed = parseInfoLine(line);
        if (!parsed) return;
        setAnalysisDepth(d => Math.max(d, parsed.depth));
        if (parsed.multipv === 1) {
          setAnalysisEval({ score: parsed.score, mate: parsed.mate, isMate: parsed.isMate });
        }
        setPvLines(prev => {
          const next = [...prev];
          next[parsed.multipv - 1] = { ...parsed, pvStr: pvToString(targetFen, parsed.pv, 8) };
          return next.filter(Boolean);
        });
      });
    }, 350);

    return () => { clearTimeout(timer); stopAnalysis(); };
  }, [phase, replayIdx, exploreGame, startAnalysis, stopAnalysis]);

  // Jump to last position when game ends
  useEffect(() => {
    if (phase === 'over') {
      setReplayIdx(moveHistoryRef.current.length);
      setExploreGame(null);
      setExploreLastMove(null);
      setExploreSelected(null);
    }
  }, [phase]);

  // Auto-scroll move list to selected entry
  useEffect(() => {
    if (phase !== 'over' || !moveListRef.current || exploreGame) return;
    const el = moveListRef.current.querySelector(`[data-idx="${replayIdx - 1}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [phase, replayIdx, exploreGame]);

  // Keyboard navigation (← →)
  useEffect(() => {
    if (phase !== 'over') return;
    function handleKey(e) {
      if (e.key === 'ArrowLeft') {
        setReplayIdx(prev => Math.max(0, prev - 1));
        setExploreGame(null); setExploreLastMove(null); setExploreSelected(null);
      } else if (e.key === 'ArrowRight') {
        setReplayIdx(prev => Math.min(moveHistoryRef.current.length, prev + 1));
        setExploreGame(null); setExploreLastMove(null); setExploreSelected(null);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase]);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  function navTo(idx) {
    setReplayIdx(Math.max(0, Math.min(moveHistoryRef.current.length, idx)));
    setExploreGame(null); setExploreLastMove(null); setExploreSelected(null);
  }
  function exitExplore() {
    setExploreGame(null); setExploreLastMove(null); setExploreSelected(null);
  }

  // ── Player move (records history) ───────────────────────────────────────────
  function commitPlayerMove(g, move) {
    fenHistoryRef.current  = [...fenHistoryRef.current,  g.fen()];
    moveSquaresRef.current = [...moveSquaresRef.current, { from: move.from, to: move.to }];
    setGame(g); setFen(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setMoveHistory(prev => [...prev, move.san]);
    setSelectedSquare(null);
    setStatus(g.isCheck() ? 'Check!' : '');
    const over = checkGameOver(g);
    if (over) { setResult(over); setPhase('over'); }
  }

  // ── Exploration move handlers (post-game) ────────────────────────────────────
  function onDropReview(sourceSquare, targetSquare) {
    const baseFen = exploreGame
      ? exploreGame.fen()
      : (fenHistoryRef.current[replayIdx] ?? new Chess().fen());
    const g = new Chess(baseFen);
    let move;
    try { move = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    setExploreGame(g);
    setExploreLastMove({ from: move.from, to: move.to });
    setExploreSelected(null);
    return true;
  }

  function onSquareClickReview(square) {
    const baseFen = exploreGame
      ? exploreGame.fen()
      : (fenHistoryRef.current[replayIdx] ?? new Chess().fen());
    const baseChess = new Chess(baseFen);

    if (exploreSelected) {
      let move;
      try { move = baseChess.move({ from: exploreSelected, to: square, promotion: 'q' }); } catch {}
      if (move) {
        setExploreGame(baseChess);
        setExploreLastMove({ from: move.from, to: move.to });
        setExploreSelected(null);
        return;
      }
      const piece = baseChess.get(square);
      setExploreSelected(piece ? square : null);
    } else {
      const piece = baseChess.get(square);
      if (piece) setExploreSelected(square);
    }
  }

  // ── Game move handlers (during play) ─────────────────────────────────────────
  function onDrop(sourceSquare, targetSquare) {
    if (phase !== 'game') return false;
    if (game.turn() !== (playerColor === 'white' ? 'w' : 'b')) return false;
    if (thinking) return false;
    const g = new Chess(game.fen());
    let move;
    try { move = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    commitPlayerMove(g, move);
    return true;
  }

  function onSquareClick(square) {
    if (phase !== 'game' || thinking) return;
    const isPlayerTurn = game.turn() === (playerColor === 'white' ? 'w' : 'b');
    if (!isPlayerTurn) return;
    if (selectedSquare) {
      const g = new Chess(game.fen());
      let move;
      try { move = g.move({ from: selectedSquare, to: square, promotion: 'q' }); } catch {}
      if (move) { commitPlayerMove(g, move); return; }
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
      else setSelectedSquare(null);
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) setSelectedSquare(square);
    }
  }

  // ── Setup / reset ─────────────────────────────────────────────────────────────
  function startGame() {
    const g = new Chess();
    fenHistoryRef.current  = [g.fen()];
    moveSquaresRef.current = [];
    setGame(g); setFen(g.fen()); setLastMove(null);
    setResult(null); setMoveHistory([]); setStatus('');
    setSelectedSquare(null); setPvLines([]); setAnalysisDepth(0); setAnalysisEval(null);
    setReplayIdx(0); setExploreGame(null); setExploreLastMove(null); setExploreSelected(null);
    setPhase('game');
  }

  function resetToSetup() {
    stopAnalysis();
    fenHistoryRef.current  = [new Chess().fen()];
    moveSquaresRef.current = [];
    setPhase('setup');
    setGame(new Chess()); setFen(new Chess().fen()); setLastMove(null);
    setResult(null); setMoveHistory([]); setStatus(''); setSelectedSquare(null);
    setPvLines([]); setAnalysisDepth(0); setAnalysisEval(null);
    setReplayIdx(0); setExploreGame(null); setExploreLastMove(null); setExploreSelected(null);
  }

  // ── Derived display values ────────────────────────────────────────────────────
  const displayFen = phase !== 'over'
    ? fen
    : exploreGame
      ? exploreGame.fen()
      : (fenHistoryRef.current[replayIdx] ?? fen);

  const reviewLastMove = !exploreGame && replayIdx > 0
    ? moveSquaresRef.current[replayIdx - 1]
    : null;

  const displayLastMove = phase !== 'over' ? lastMove
    : exploreGame ? exploreLastMove
    : reviewLastMove;

  // Legal move dots
  const legalMoveDots = {};
  if (phase === 'over' && exploreSelected) {
    const baseChess = new Chess(exploreGame ? exploreGame.fen() : (fenHistoryRef.current[replayIdx] ?? fen));
    baseChess.moves({ square: exploreSelected, verbose: true }).forEach(m => {
      legalMoveDots[m.to] = {
        background: baseChess.get(m.to)
          ? 'radial-gradient(circle, rgba(0,0,0,.35) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.25) 30%, transparent 30%)',
        borderRadius: '50%',
      };
    });
  } else if (phase === 'game' && selectedSquare) {
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
    ...(displayLastMove ? {
      [displayLastMove.from]: { background: 'rgba(229,139,0,0.35)' },
      [displayLastMove.to]:   { background: 'rgba(229,139,0,0.45)' },
    } : {}),
    ...(phase === 'over' && exploreSelected ? { [exploreSelected]: { background: 'rgba(255,215,0,0.55)' } } : {}),
    ...(phase === 'game' && selectedSquare  ? { [selectedSquare]:  { background: 'rgba(255,215,0,0.55)' } } : {}),
    ...legalMoveDots,
  };

  // Eval bar
  let evalPct   = 50;
  let evalLabel = '0.0';
  let evalColor = 'var(--cream)';
  if (analysisEval) {
    if (analysisEval.isMate) {
      evalPct   = analysisEval.mate > 0 ? 96 : 4;
      evalLabel = `M${Math.abs(analysisEval.mate)}`;
      evalColor = analysisEval.mate > 0 ? 'var(--green)' : '#e57373';
    } else if (analysisEval.score !== null) {
      const c   = Math.max(-6, Math.min(6, analysisEval.score));
      evalPct   = 50 + (c / 6) * 46;
      evalLabel = analysisEval.score > 0
        ? `+${analysisEval.score.toFixed(1)}`
        : analysisEval.score.toFixed(1);
      evalColor = analysisEval.score > 0.15 ? 'var(--green)'
                : analysisEval.score < -0.15 ? '#e57373'
                : 'var(--cream)';
    }
  }

  // ── Setup screen ──────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="pvs-root">
        <div className="pvs-setup">
          <h2 className="pvs-title">Play vs Stockfish</h2>
          <p className="pvs-sub">Choose your color and difficulty, then start playing.</p>

          <div className="pvs-section-label">Play as</div>
          <div className="pvs-color-row">
            {['white', 'black'].map(c => (
              <button key={c}
                className={`pvs-color-btn ${playerColor === c ? 'pvs-color-active' : ''}`}
                onClick={() => setPlayerColor(c)}
              >
                <span>{c === 'white' ? '♔' : '♚'}</span>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>

          <div className="pvs-section-label">Difficulty</div>
          <div className="pvs-levels">
            {LEVELS.map((l, i) => (
              <button key={l.label}
                className={`pvs-level ${levelIdx === i ? 'pvs-level-active' : ''}`}
                onClick={() => setLevelIdx(i)}
              >
                <span className="pvs-level-name">{l.label}</span>
                <span className="pvs-level-elo">{l.elo}</span>
              </button>
            ))}
          </div>

          <button className="pvs-start-btn" onClick={startGame}>Start Game →</button>
        </div>
      </div>
    );
  }

  // ── Game + Post-game (unified board layout) ───────────────────────────────────
  const isPlayerTurn = phase === 'game' && game.turn() === (playerColor === 'white' ? 'w' : 'b');
  const turnLabel = thinking ? 'Engine is thinking…'
                  : isPlayerTurn ? 'Your turn'
                  : "Engine's turn";

  const totalMoves = moveHistory.length;

  return (
    <div className="pvs-root">
      <div className="pvs-game-layout">

        {/* ── Board column ── */}
        <div className="pvs-board-col">
          {phase === 'over' && result && (
            <div className={`pvs-result-banner pvs-result-banner-${result.type}`}>
              <span className="pvs-result-icon">
                {result.type === 'win' ? '🏆' : result.type === 'loss' ? '😞' : '🤝'}
              </span>
              <span className="pvs-result-text">{result.text}</span>
              <span className="pvs-result-lvl">vs Stockfish · {LEVELS[levelIdx].label}</span>
            </div>
          )}

          <div className="pvs-board-wrap">
            <Chessboard
              customPieces={CHESS_PIECES}
              position={displayFen}
              onPieceDrop={phase === 'game' ? onDrop : onDropReview}
              onSquareClick={phase === 'game' ? onSquareClick : onSquareClickReview}
              boardOrientation={playerColor}
              customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
              customDarkSquareStyle={{ backgroundColor: boardDark }}
              customLightSquareStyle={{ backgroundColor: boardLight }}
              customSquareStyles={customSquareStyles}
              areArrowsAllowed={false}
            />
          </div>

          {/* Navigation bar (post-game) */}
          {phase === 'over' && (
            <div className="pvs-nav-bar">
              <button className="pvs-nav-btn" onClick={() => navTo(0)}
                disabled={replayIdx === 0 && !exploreGame} title="First move">
                ⏮
              </button>
              <button className="pvs-nav-btn" onClick={() => { navTo(replayIdx - 1); }}
                disabled={replayIdx === 0 && !exploreGame} title="Previous (←)">
                ◀
              </button>
              <span className="pvs-nav-pos">
                {exploreGame
                  ? <span className="pvs-explore-tag">Exploring</span>
                  : `${replayIdx} / ${totalMoves}`}
              </span>
              <button className="pvs-nav-btn" onClick={() => navTo(replayIdx + 1)}
                disabled={replayIdx >= totalMoves && !exploreGame} title="Next (→)">
                ▶
              </button>
              <button className="pvs-nav-btn" onClick={() => navTo(totalMoves)}
                disabled={replayIdx >= totalMoves && !exploreGame} title="Last move">
                ⏭
              </button>
              {exploreGame && (
                <button className="pvs-nav-exit-explore" onClick={exitExplore}>Exit Explore</button>
              )}
            </div>
          )}

          {status && <div className="pvs-check-banner">{status}</div>}
          <OpeningBadge opening={detectOpeningByMoves(moveHistory)} />
        </div>

        {/* ── Side panel ── */}
        <div className="pvs-side">
          {phase === 'over' ? (
            <>
              {/* Eval bar */}
              <div className="pvs-eval-wrap">
                <div className="pvs-eval-bar">
                  <div className="pvs-eval-white-fill" style={{ width: `${evalPct}%` }} />
                  <div className="pvs-eval-black-fill" style={{ width: `${100 - evalPct}%` }} />
                </div>
                <div className="pvs-eval-meta">
                  <span className="pvs-eval-score" style={{ color: evalColor }}>
                    {analysisEval ? evalLabel : '…'}
                  </span>
                  {analysisDepth > 0 && (
                    <span className="pvs-eval-depth">depth {analysisDepth}</span>
                  )}
                </div>
              </div>

              {/* Top 4 Stockfish lines */}
              <div className="pvs-analysis-card">
                <div className="pvs-analysis-title">Stockfish Top Lines</div>
                {pvLines.length === 0 ? (
                  <div className="pvs-analysing">
                    <span className="pvs-dot-anim">···</span> Analysing…
                  </div>
                ) : (
                  pvLines.map((line, i) => {
                    const sc = line.isMate
                      ? `M${Math.abs(line.mate)}`
                      : line.score !== null
                        ? (line.score > 0 ? `+${line.score.toFixed(1)}` : line.score.toFixed(1))
                        : '—';
                    const scColor = line.isMate
                      ? (line.mate > 0 ? 'var(--green)' : '#e57373')
                      : line.score > 0.15 ? 'var(--green)'
                      : line.score < -0.15 ? '#e57373'
                      : 'var(--cream)';
                    return (
                      <div key={i} className="pvs-pv-row">
                        <span className="pvs-pv-score" style={{ color: scColor }}>{sc}</span>
                        <span className="pvs-pv-moves">{line.pvStr}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clickable move list */}
              <div className="pvs-history-card pvs-history-compact" ref={moveListRef}>
                <div className="pvs-history-title">
                  Game moves
                  <span className="pvs-hist-hint">click to jump · ← → keys</span>
                </div>
                <div className="pvs-history-body">
                  {/* Position 0 chip */}
                  <span
                    className={`pvs-hist-start${replayIdx === 0 && !exploreGame ? ' pvs-hist-selected' : ''}`}
                    onClick={() => navTo(0)}
                  >Start</span>
                  {moveHistory.map((m, i) => (
                    <span
                      key={i}
                      data-idx={i}
                      className={`pvs-hist-move pvs-hist-clickable${replayIdx === i + 1 && !exploreGame ? ' pvs-hist-selected' : ''}`}
                      onClick={() => navTo(i + 1)}
                    >
                      {i % 2 === 0 && <span className="pvs-hist-num">{Math.floor(i / 2) + 1}.</span>}
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pvs-over-btns-side">
                <button className="pvs-start-btn" onClick={startGame}>Play Again</button>
                <button className="pvs-ghost-btn" onClick={resetToSetup}>Change Settings</button>
              </div>
            </>
          ) : (
            <>
              <div className="pvs-info-card">
                <div className="pvs-level-badge">{LEVELS[levelIdx].label}</div>
                <div className={`pvs-turn ${thinking ? 'pvs-thinking' : isPlayerTurn ? 'pvs-your-turn' : ''}`}>
                  {thinking && <span className="pvs-dot-anim">···</span>}
                  {turnLabel}
                </div>
              </div>

              <div className="pvs-history-card">
                <div className="pvs-history-title">Moves</div>
                <div className="pvs-history-body">
                  {moveHistory.length === 0 && <span className="pvs-no-moves">No moves yet</span>}
                  {moveHistory.map((m, i) => (
                    <span key={i} className="pvs-hist-move">
                      {i % 2 === 0 && <span className="pvs-hist-num">{Math.floor(i / 2) + 1}.</span>}
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <button className="pvs-resign-btn" onClick={resetToSetup}>↩ New Game</button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
