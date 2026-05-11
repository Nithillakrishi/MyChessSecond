import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors } from '../contexts/ThemeContext';
import './PlayVsStockfish.css';

const LEVELS = [
  { label: 'Beginner',     depth: 1,  elo: '~500'  },
  { label: 'Casual',       depth: 3,  elo: '~1000' },
  { label: 'Intermediate', depth: 6,  elo: '~1400' },
  { label: 'Advanced',     depth: 10, elo: '~1800' },
  { label: 'Master',       depth: 15, elo: '~2400' },
];

function useStockfishEngine() {
  const engineRef = useRef(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    const engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`);
    engineRef.current = engine;

    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
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

    return () => {
      engine.postMessage('quit');
      engine.terminate();
    };
  }, []);

  const getBestMove = useCallback((fen, depth) => {
    return new Promise((resolve) => {
      if (!engineRef.current) { resolve(null); return; }
      resolveRef.current = resolve;
      engineRef.current.postMessage('stop');
      engineRef.current.postMessage(`position fen ${fen}`);
      engineRef.current.postMessage(`go depth ${depth}`);
    });
  }, []);

  return { getBestMove };
}

export default function PlayVsStockfish() {
  const { dark: boardDark, light: boardLight } = useBoardColors();
  const [phase, setPhase] = useState('setup'); // setup | game | over
  const [playerColor, setPlayerColor] = useState('white');
  const [levelIdx, setLevelIdx] = useState(1);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(new Chess().fen());
  const [status, setStatus] = useState('');
  const [thinking, setThinking] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [result, setResult] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  const { getBestMove } = useStockfishEngine();
  const engineColor = playerColor === 'white' ? 'b' : 'w';

  const checkGameOver = useCallback((g) => {
    if (g.isCheckmate()) {
      const winner = g.turn() === 'w' ? 'Black' : 'White';
      return winner === (playerColor === 'white' ? 'White' : 'Black')
        ? { text: 'You win! 🎉 Checkmate!', type: 'win' }
        : { text: 'Checkmate. Engine wins.', type: 'loss' };
    }
    if (g.isDraw()) {
      let reason = 'Draw';
      if (g.isStalemate()) reason = 'Stalemate';
      else if (g.isThreefoldRepetition()) reason = 'Threefold repetition';
      else if (g.isInsufficientMaterial()) reason = 'Insufficient material';
      return { text: reason, type: 'draw' };
    }
    return null;
  }, [playerColor]);

  const doEngineMove = useCallback(async (currentGame) => {
    setThinking(true);
    const depth = LEVELS[levelIdx].depth;
    const uciMove = await getBestMove(currentGame.fen(), depth);
    setThinking(false);

    if (!uciMove) return;

    const g = new Chess(currentGame.fen());
    const from = uciMove.slice(0, 2);
    const to   = uciMove.slice(2, 4);
    const promo = uciMove[4] || 'q';
    const result = g.move({ from, to, promotion: promo });
    if (!result) return;

    setGame(g);
    setFen(g.fen());
    setLastMove({ from: result.from, to: result.to });
    setMoveHistory(prev => [...prev, result.san]);
    setStatus(g.isCheck() ? 'Check!' : '');

    const over = checkGameOver(g);
    if (over) { setResult(over); setPhase('over'); }
  }, [levelIdx, getBestMove, checkGameOver]);

  // Engine moves when it's the engine's turn
  useEffect(() => {
    if (phase !== 'game') return;
    if (game.turn() !== engineColor) return;
    if (game.isGameOver()) return;

    const timer = setTimeout(() => {
      doEngineMove(game);
    }, 300);

    return () => clearTimeout(timer);
  }, [phase, game, engineColor, doEngineMove]);

  // If player is black, engine plays first
  useEffect(() => {
    if (phase === 'game' && playerColor === 'black') {
      doEngineMove(new Chess());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function onDrop(sourceSquare, targetSquare, piece) {
    if (phase !== 'game') return false;
    if (game.turn() !== (playerColor === 'white' ? 'w' : 'b')) return false;
    if (thinking) return false;

    const g = new Chess(game.fen());
    const move = g.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece?.slice(-1)?.toLowerCase() || 'q',
    });
    if (!move) return false;

    setGame(g);
    setFen(g.fen());
    setLastMove({ from: move.from, to: move.to });
    setMoveHistory(prev => [...prev, move.san]);
    setStatus(g.isCheck() ? 'Check!' : '');

    const over = checkGameOver(g);
    if (over) { setResult(over); setPhase('over'); }

    return true;
  }

  function startGame() {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setLastMove(null);
    setResult(null);
    setMoveHistory([]);
    setStatus('');
    setPhase('game');
  }

  function resetToSetup() {
    setPhase('setup');
    setGame(new Chess());
    setFen(new Chess().fen());
    setLastMove(null);
    setResult(null);
    setMoveHistory([]);
    setStatus('');
  }

  const customSquareStyles = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { background: 'rgba(229,139,0,0.35)' };
    customSquareStyles[lastMove.to]   = { background: 'rgba(229,139,0,0.45)' };
  }

  /* ── Setup screen ── */
  if (phase === 'setup') {
    return (
      <div className="pvs-root">
        <div className="pvs-setup">
          <h2 className="pvs-title">Play vs Stockfish</h2>
          <p className="pvs-sub">Choose your color and difficulty, then start playing.</p>

          <div className="pvs-section-label">Play as</div>
          <div className="pvs-color-row">
            {['white', 'black'].map(c => (
              <button
                key={c}
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
              <button
                key={l.label}
                className={`pvs-level ${levelIdx === i ? 'pvs-level-active' : ''}`}
                onClick={() => setLevelIdx(i)}
              >
                <span className="pvs-level-name">{l.label}</span>
                <span className="pvs-level-elo">{l.elo}</span>
              </button>
            ))}
          </div>

          <button className="pvs-start-btn" onClick={startGame}>
            Start Game →
          </button>
        </div>
      </div>
    );
  }

  /* ── Game over screen ── */
  if (phase === 'over') {
    return (
      <div className="pvs-root">
        <div className="pvs-over">
          <div className={`pvs-result-badge pvs-result-${result?.type}`}>
            {result?.type === 'win' ? '🏆' : result?.type === 'loss' ? '😞' : '🤝'}
          </div>
          <h2 className="pvs-over-title">{result?.text}</h2>
          <p className="pvs-over-sub">vs Stockfish · {LEVELS[levelIdx].label}</p>
          <div className="pvs-over-history">
            {moveHistory.map((m, i) => (
              <span key={i} className="pvs-history-move">
                {i % 2 === 0 && <span className="pvs-move-num">{Math.floor(i/2)+1}.</span>}
                {m}
              </span>
            ))}
          </div>
          <div className="pvs-over-btns">
            <button className="pvs-start-btn" onClick={startGame}>Play Again</button>
            <button className="pvs-ghost-btn" onClick={resetToSetup}>Change Settings</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Active game ── */
  const isPlayerTurn = game.turn() === (playerColor === 'white' ? 'w' : 'b');
  const turnLabel = thinking ? 'Engine is thinking…'
    : isPlayerTurn ? 'Your turn'
    : 'Engine\'s turn';

  return (
    <div className="pvs-root">
      <div className="pvs-game-layout">
        {/* Board column */}
        <div className="pvs-board-col">
          <div className="pvs-board-wrap">
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={playerColor}
              customBoardStyle={{ borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
              customDarkSquareStyle={{ backgroundColor: boardDark }}
              customLightSquareStyle={{ backgroundColor: boardLight }}
              customSquareStyles={customSquareStyles}
              areArrowsAllowed={false}
            />
          </div>

          {status && <div className="pvs-check-banner">{status}</div>}
        </div>

        {/* Side panel */}
        <div className="pvs-side">
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
                  {i % 2 === 0 && <span className="pvs-hist-num">{Math.floor(i/2)+1}.</span>}
                  {m}
                </span>
              ))}
            </div>
          </div>

          <button className="pvs-resign-btn" onClick={resetToSetup}>
            ↩ New Game
          </button>
        </div>
      </div>
    </div>
  );
}
