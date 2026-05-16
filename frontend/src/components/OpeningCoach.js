import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors, useArrowColors } from '../contexts/ThemeContext';
import { CHESS_PIECES } from './boardPieces';
import openingsData from '../data/openings.json';
import './OpeningCoach.css';

const API = process.env.REACT_APP_API_BASE || 'http://localhost:8000';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* ── helpers ─────────────────────────────────────────────── */
function searchOpenings(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return openingsData.filter(o => o.name.toLowerCase().includes(q)).slice(0, 12);
}

function getPathFromRoot(nodeId, nodes) {
  const path = [];
  let cur = nodeId;
  while (cur && cur !== 'root') {
    path.unshift(cur);
    cur = nodes[cur]?.parentId;
  }
  return path;
}

function buildTreeFromMoves(moves) {
  const nodes = {
    root: { id: 'root', san: null, fen: START_FEN, parentId: null, childIds: [], depth: 0, isMainLine: true },
  };
  const tmp = new Chess();
  let parent = 'root';
  for (let i = 0; i < moves.length; i++) {
    try {
      const r = tmp.move(moves[i]);
      if (!r) break;
      const id = `m${i}`;
      nodes[id] = { id, san: r.san, fen: tmp.fen(), parentId: parent, childIds: [], depth: i + 1, isMainLine: true };
      nodes[parent].childIds.push(id);
      parent = id;
    } catch { break; }
  }
  return nodes;
}

/* ── WinBar ──────────────────────────────────────────────── */
function WinBar({ label, rate, color }) {
  return (
    <div className="oc-winbar">
      <span className="oc-winbar-label">{label}</span>
      <div className="oc-winbar-track">
        <div className="oc-winbar-fill" style={{ width: `${rate}%`, background: color }} />
      </div>
      <span className="oc-winbar-val" style={{ color }}>{rate}%</span>
    </div>
  );
}

/* ── EvalBar ─────────────────────────────────────────────── */
function EvalBar({ evalScore, flipped }) {
  const c = Math.max(-6, Math.min(6, evalScore ?? 0));
  const wPct = 50 + (c / 6) * 40;
  const lbl = evalScore === null ? '?'
    : Math.abs(evalScore) >= 99 ? (evalScore > 0 ? 'M' : '-M')
    : evalScore > 0 ? `+${evalScore.toFixed(1)}` : evalScore.toFixed(1);
  // flipped=true → white on top, black on bottom
  const topWins = flipped ? c > 0 : c < 0;
  const botWins = flipped ? c < 0 : c > 0;
  return (
    <div className="oc-eval-bar">
      <div className="oc-eval-track">
        {flipped ? (
          <>
            <div className="oc-eval-white" style={{ height: `${wPct}%` }} />
            <div className="oc-eval-black" style={{ height: `${100 - wPct}%` }} />
          </>
        ) : (
          <>
            <div className="oc-eval-black" style={{ height: `${100 - wPct}%` }} />
            <div className="oc-eval-white" style={{ height: `${wPct}%` }} />
          </>
        )}
      </div>
      <div className="oc-eval-score-badge">{lbl}</div>
    </div>
  );
}

/* ── ChatMessage ─────────────────────────────────────────── */
function ChatMessage({ msg }) {
  return (
    <div className={`oc-msg oc-msg-${msg.role}`}>
      <div className="oc-msg-avatar">{msg.role === 'assistant' ? '♟' : '?'}</div>
      <div className="oc-msg-bubble">
        {msg.content.split('\n').map((l, i) =>
          l.startsWith('★')
            ? <div key={i} className="oc-verdict">{l}</div>
            : <p key={i}>{l}</p>
        )}
      </div>
    </div>
  );
}

/* ── MoveLine: recursive variation tree display ──────────── */
function MoveLine({ startId, nodes, curId, onGoTo, isVar = false }) {
  const items = [];
  let id = startId;
  while (id) {
    const node = nodes[id];
    if (!node?.san) break;
    const isWhite = node.depth % 2 === 1;
    const mn = Math.ceil(node.depth / 2);
    if (isWhite || (isVar && items.length === 0)) {
      items.push(
        <span key={`n-${id}`} className="oc-ml-num">{isWhite ? `${mn}.` : `${mn}…`}</span>
      );
    }
    items.push(
      <span
        key={id}
        className={`oc-ml-san${id === curId ? ' oc-ml-cur' : ''}${!node.isMainLine ? ' oc-ml-var-mv' : ''}`}
        onClick={() => onGoTo(id)}
      >{node.san}</span>
    );
    for (let i = 1; i < (node.childIds?.length || 0); i++) {
      items.push(
        <span key={`v-${node.childIds[i]}`} className="oc-ml-var-wrap">
          <span className="oc-ml-paren">{'('}</span>
          <MoveLine startId={node.childIds[i]} nodes={nodes} curId={curId} onGoTo={onGoTo} isVar />
          <span className="oc-ml-paren">{')'}</span>
        </span>
      );
    }
    id = node.childIds?.[0] || null;
  }
  return <>{items}</>;
}

/* ── Main component ──────────────────────────────────────── */
export default function OpeningCoach({ username, playerProfile, isActive = true }) {
  const boardColors  = useBoardColors();
  const arrowColors  = useArrowColors();

  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState(null);
  const searchRef = useRef(null);

  const [chess]          = useState(() => new Chess());
  const [fen, setFen]    = useState(chess.fen());
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [selectedSq, setSelectedSq]    = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);

  const [treeNodes, setTreeNodes]     = useState({});
  const [currentNodeId, setCurrentNodeId] = useState('root');
  const treeRef  = useRef({});
  const notesRef = useRef({});

  const [chatHistory, setChatHistory]   = useState([]);
  const [inputMsg, setInputMsg]         = useState('');
  const [isStreaming, setIsStreaming]   = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const chatEndRef = useRef(null);

  const [notes, setNotes]         = useState({});
  const [noteInput, setNoteInput] = useState('');

  const [sessions, setSessions]         = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [saveStatus, setSaveStatus]     = useState('');

  const [evalScore, setEvalScore]   = useState(null);
  const [topMoves, setTopMoves]     = useState([]);
  const [analysisFen, setAnalysisFen] = useState(null); // FEN that topMoves belongs to
  const [chatOpen, setChatOpen]   = useState(true);
  const [isMobile, setIsMobile]   = useState(() => window.innerWidth <= 600);
  const [preloaded, setPreloaded] = useState(null);
  const explainedNodesRef = useRef(new Set());
  const playerProfileRef  = useRef(playerProfile);
  const engineRef        = useRef(null);
  const engineReadyRef   = useRef(false);
  const engineBusyRef    = useRef(false); // true while a 'go' is active
  const listeningRef     = useRef(true);  // false while waiting for bestmove to flush stale lines
  const startAnalysisRef = useRef(null);  // set once engine worker is ready
  const pendingFenRef    = useRef(null);
  const lastEvalFenRef   = useRef(START_FEN);
  const sendMessageRef        = useRef(null);
  const isStreamingRef        = useRef(false);
  const chatHistoryRef        = useRef([]);
  const justSelectedRef        = useRef(false);

  useEffect(() => { treeRef.current        = treeNodes;      }, [treeNodes]);
  useEffect(() => { notesRef.current       = notes;          }, [notes]);
  useEffect(() => { isStreamingRef.current = isStreaming;    }, [isStreaming]);
  useEffect(() => { chatHistoryRef.current = chatHistory;    }, [chatHistory]);
  useEffect(() => { playerProfileRef.current = playerProfile; }, [playerProfile]);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  /* ── Stockfish ─────────────────────────────────────────── */
  useEffect(() => {
    let engine;
    try { engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`); }
    catch { return; }
    engineRef.current = engine;
    engineReadyRef.current = false;
    engine.onerror = () => {};
    const startAnalysis = (fenToAnalyse) => {
      lastEvalFenRef.current = fenToAnalyse;
      setAnalysisFen(fenToAnalyse); // marks which position topMoves belongs to
      engine.postMessage(`position fen ${fenToAnalyse}`);
      engine.postMessage('go depth 14');
      engineBusyRef.current = true;
      listeningRef.current = true;
    };
    startAnalysisRef.current = startAnalysis;

    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line === 'uciok') {
        engine.postMessage('setoption name MultiPV value 5');
        engine.postMessage('ucinewgame');
        engine.postMessage('isready');
        return;
      }
      if (line === 'readyok') {
        engineReadyRef.current = true;
        if (pendingFenRef.current) {
          const f = pendingFenRef.current;
          pendingFenRef.current = null;
          setTopMoves([]);
          startAnalysis(f);
        }
        return;
      }
      // bestmove signals the old 'go' has fully stopped — safe to start the next one
      if (line.startsWith('bestmove')) {
        engineBusyRef.current = false;
        if (pendingFenRef.current) {
          const f = pendingFenRef.current;
          pendingFenRef.current = null;
          setTopMoves([]);
          startAnalysis(f);
        }
        return;
      }
      // Discard any line emitted after we stopped listening (stale analysis)
      if (!listeningRef.current) return;
      // Only use multipv 1 line for eval score
      const isLine1 = !line.includes('multipv') || line.includes('multipv 1');
      const cp = line.match(/score cp (-?\d+)/);
      const mt = line.match(/score mate (-?\d+)/);
      if (isLine1 && cp) {
        const turn = lastEvalFenRef.current.split(' ')[1];
        const raw  = parseInt(cp[1]);
        setEvalScore(parseFloat(((turn === 'b' ? -raw : raw) / 100).toFixed(1)));
      } else if (isLine1 && mt) {
        const turn = lastEvalFenRef.current.split(' ')[1];
        const m    = parseInt(mt[1]);
        const norm = turn === 'b' ? -m : m;
        setEvalScore(norm > 0 ? 99 : -99);
      }
      const pvMatch = line.match(/multipv (\d+).*?\bpv ([a-h][1-8])([a-h][1-8])/);
      if (pvMatch) {
        const rank = parseInt(pvMatch[1]) - 1;
        const from = pvMatch[2];
        const to   = pvMatch[3];
        let mvScore = null;
        const cpM = line.match(/score cp (-?\d+)/);
        const mtM = line.match(/score mate (-?\d+)/);
        if (cpM) {
          const turn = lastEvalFenRef.current.split(' ')[1];
          const raw = parseInt(cpM[1]);
          mvScore = parseFloat(((turn === 'b' ? -raw : raw) / 100).toFixed(2));
        } else if (mtM) {
          mvScore = parseInt(mtM[1]) > 0 ? 99 : -99;
        }
        if (rank >= 0 && rank < 5) {
          setTopMoves(prev => {
            const next = [...prev];
            next[rank] = { from, to, score: mvScore };
            return next;
          });
        }
      }
    };
    engine.postMessage('uci');
    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setEvalScore(null);
    setTopMoves([]);
    setAnalysisFen(null); // clear confirmed-FEN so stale topMoves are never rendered
    // Don't analyse at start position — no opening selected yet
    if (fen === START_FEN) { pendingFenRef.current = null; listeningRef.current = false; return; }
    if (!isActive) { pendingFenRef.current = fen; listeningRef.current = false; return; }
    if (!engineReadyRef.current) { pendingFenRef.current = fen; listeningRef.current = false; return; }
    if (engineBusyRef.current) {
      // Immediately stop listening so stale lines from the old analysis are ignored
      listeningRef.current = false;
      pendingFenRef.current = fen;
      engine.postMessage('stop'); // bestmove handler will start the new analysis
    } else {
      pendingFenRef.current = null;
      startAnalysisRef.current?.(fen);
    }
  }, [fen, isActive]);

  /* ── Search ────────────────────────────────────────────── */
  useEffect(() => { setResults(searchOpenings(query)); }, [query]);
  useEffect(() => {
    function h(e) { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Show cached theory explanation when navigating main-line moves ── */
  useEffect(() => {
    if (!preloaded || currentNodeId === 'root' || !selectedOpening) return;
    const node = treeRef.current[currentNodeId];
    if (!node?.isMainLine) return;
    if (explainedNodesRef.current.has(currentNodeId)) return;
    const explanation = preloaded.explanations?.[currentNodeId];
    if (!explanation) return;
    explainedNodesRef.current.add(currentNodeId);
    setChatHistory(prev => [...prev, { role: 'assistant', content: explanation }]);
  }, [currentNodeId, preloaded, selectedOpening]); // eslint-disable-line

  /* ── goToNode ──────────────────────────────────────────── */
  const goToNode = useCallback((nodeId, nodesOverride) => {
    listeningRef.current = false; // block stale engine lines before React re-renders
    const nodes = nodesOverride || treeRef.current;
    const path  = getPathFromRoot(nodeId, nodes);
    chess.reset();
    for (const id of path) {
      const node = nodes[id];
      if (node?.san) { try { chess.move(node.san); } catch {} }
    }
    setFen(chess.fen());
    setCurrentNodeId(nodeId);
    setNoteInput(notesRef.current[nodeId] || '');
    setSelectedSq(null);
    setLegalTargets([]);
  }, [chess]);

  /* ── Navigation ────────────────────────────────────────── */
  const stepBack = useCallback(() => {
    const node = treeRef.current[currentNodeId];
    if (!node?.parentId && currentNodeId !== 'root') return;
    if (node?.parentId) goToNode(node.parentId);
  }, [currentNodeId, goToNode]);

  const stepForward = useCallback(() => {
    const node = treeRef.current[currentNodeId];
    if (!node?.childIds?.length) return;
    goToNode(node.childIds[0]);
  }, [currentNodeId, goToNode]);

  const goToEnd = useCallback(() => {
    let cur = currentNodeId;
    while (treeRef.current[cur]?.childIds?.[0]) cur = treeRef.current[cur].childIds[0];
    goToNode(cur);
  }, [currentNodeId, goToNode]);

  useEffect(() => {
    function h(e) {
      if (!selectedOpening) return;
      if (e.key === 'ArrowLeft')  stepBack();
      if (e.key === 'ArrowRight') stepForward();
    }
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedOpening, stepBack, stepForward]);

  /* ── Make move (board interaction) ────────────────────── */
  const makeMove = useCallback((from, to) => {
    listeningRef.current = false; // block stale engine lines before React re-renders
    let move;
    try { move = chess.move({ from, to, promotion: 'q' }); }
    catch { return false; }
    if (!move) return false;

    const newFen = chess.fen();
    const newSan = move.san;
    const curNode = treeRef.current[currentNodeId];
    if (!curNode) return false;

    const existingId = curNode.childIds?.find(id => treeRef.current[id]?.san === newSan);
    if (existingId) {
      setFen(newFen);
      setCurrentNodeId(existingId);
      setNoteInput(notesRef.current[existingId] || '');
      setSelectedSq(null);
      setLegalTargets([]);
      return true;
    }

    const newId   = `u${Date.now()}`;
    const newNode = {
      id: newId, san: newSan, fen: newFen,
      parentId: currentNodeId,
      childIds: [],
      depth: (curNode.depth || 0) + 1,
      isMainLine: false,
    };
    setTreeNodes(prev => {
      const updated = {
        ...prev,
        [newId]: newNode,
        [currentNodeId]: { ...prev[currentNodeId], childIds: [...(prev[currentNodeId]?.childIds || []), newId] },
      };
      treeRef.current = updated;
      return updated;
    });
    setFen(newFen);
    setCurrentNodeId(newId);
    setNoteInput('');
    setSelectedSq(null);
    setLegalTargets([]);
    return true;
  }, [chess, currentNodeId]);

  function onPieceDrop(from, to) { return makeMove(from, to); }

  function onSquareClick(sq) {
    if (selectedSq) {
      if (sq === selectedSq) { setSelectedSq(null); setLegalTargets([]); return; }
      const moved = makeMove(selectedSq, sq);
      if (!moved) {
        const piece = chess.get(sq);
        if (piece && piece.color === chess.turn()) {
          setSelectedSq(sq);
          setLegalTargets(chess.moves({ square: sq, verbose: true }).map(m => m.to));
        } else { setSelectedSq(null); setLegalTargets([]); }
      }
      return;
    }
    const piece = chess.get(sq);
    if (piece && piece.color === chess.turn()) {
      setSelectedSq(sq);
      setLegalTargets(chess.moves({ square: sq, verbose: true }).map(m => m.to));
    }
  }

  const customSquareStyles = {};
  if (selectedSq) {
    customSquareStyles[selectedSq] = { backgroundColor: 'rgba(255,255,100,0.35)' };
    legalTargets.forEach(sq => {
      customSquareStyles[sq] = chess.get(sq)
        ? { background: 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.35) 58%)' }
        : { background: 'radial-gradient(circle, rgba(0,0,0,0.22) 28%, transparent 28%)' };
    });
  }

  /* ── Chat ──────────────────────────────────────────────── */
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, streamBuffer]);

  async function sendMessage(userText, history, opening, movesStr) {
    const op = opening || selectedOpening;
    const ms = movesStr !== undefined ? movesStr
      : getPathFromRoot(currentNodeId, treeRef.current).map(id => treeRef.current[id]?.san).filter(Boolean).join(' ');
    if (!op || isStreaming) return;
    const newHistory = [...history, { role: 'user', content: userText }];
    setChatHistory(newHistory);
    setInputMsg('');
    setIsStreaming(true);
    setStreamBuffer('');
    try {
      const res = await fetch(`${API}/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, opening_name: op.name, opening_eco: op.eco,
          opening_moves: ms, chat_history: history,
          user_message: userText, player_profile: playerProfile || null,
          current_fen: chess.fen(),
        }),
      });
      if (!res.ok) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamBuffer(full);
      }
      setChatHistory(prev => [...prev, { role: 'assistant', content: full }]);
      setStreamBuffer('');
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.' }]);
    } finally { setIsStreaming(false); }
  }

  sendMessageRef.current = sendMessage;

  function handleSend() {
    if (!inputMsg.trim() || isStreaming || !selectedOpening) return;
    sendMessage(inputMsg.trim(), chatHistory);
  }
  function handleInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  /* ── Select opening ────────────────────────────────────── */
  const selectOpening = useCallback(async (opening) => {
    setSelectedOpening(opening);
    setQuery(opening.name);
    setShowDropdown(false);
    const moves = opening.moves ? opening.moves.split(' ').filter(Boolean) : [];
    const nodes = buildTreeFromMoves(moves);
    treeRef.current = nodes;
    setTreeNodes(nodes);
    setCurrentNodeId('root');
    chess.reset();
    setFen(chess.fen());
    setNotes({});
    setNoteInput('');
    setCurrentSessionId(null);
    setSelectedSq(null);
    setLegalTargets([]);
    setChatHistory([]);
    setStreamBuffer('');
    setPreloaded(null);
    explainedNodesRef.current = new Set();
    justSelectedRef.current = true;

    // Show thinking indicator while loading
    setIsStreaming(true);
    try {
      const res = await fetch(`${API}/coach/preload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_name: opening.name,
          opening_eco:  opening.eco,
          opening_moves: moves.join(' '),
          player_profile: playerProfileRef.current,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPreloaded(data);
      if (data.intro) {
        setChatHistory([{ role: 'assistant', content: data.intro }]);
      }
    } catch (err) {
      setChatHistory([{ role: 'assistant', content: '⚠️ Could not load opening guide. You can still ask questions manually.' }]);
    } finally {
      setIsStreaming(false);
      setTimeout(() => { justSelectedRef.current = false; }, 1000);
    }
  }, [chess]); // eslint-disable-line

  /* ── Notes ─────────────────────────────────────────────── */
  function saveNote() {
    if (currentNodeId === 'root') return;
    setNotes(prev => ({ ...prev, [currentNodeId]: noteInput }));
  }

  /* ── Auto-load sessions on mount ──────────────────────── */
  useEffect(() => { loadSessionList(); }, []); // eslint-disable-line

  /* ── Sessions ──────────────────────────────────────────── */
  async function loadSessionList() {
    try {
      const res = await fetch(`${API}/coach/sessions?username=${encodeURIComponent(username)}`);
      setSessions((await res.json()).sessions || []);
    } catch {}
  }

  async function saveSession() {
    if (!selectedOpening) return;
    const mainMoves = [];
    let cur = treeRef.current['root']?.childIds?.[0];
    while (cur && treeRef.current[cur]?.isMainLine) {
      mainMoves.push(treeRef.current[cur].san);
      cur = treeRef.current[cur].childIds?.[0];
    }
    setSaveStatus('saving…');
    try {
      const res = await fetch(`${API}/coach/session/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, opening_name: selectedOpening.name, opening_eco: selectedOpening.eco,
          opening_moves: mainMoves.join(' '), chat_history: chatHistory,
          board_move_index: treeRef.current[currentNodeId]?.depth ?? 0,
          notes, session_id: currentSessionId || null,
        }),
      });
      const data = await res.json();
      setCurrentSessionId(data.session_id);
      setSaveStatus('saved ✓');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch { setSaveStatus('error'); }
  }

  async function loadSession(sid) {
    listeningRef.current = false; // block stale engine lines while session loads
    try {
      const res = await fetch(`${API}/coach/session/${sid}?username=${encodeURIComponent(username)}`);
      const s   = await res.json();
      const opening = openingsData.find(o => o.name === s.opening_name) || { name: s.opening_name, eco: s.opening_eco };
      setSelectedOpening(opening);
      setQuery(opening.name);
      const moves = (s.opening_moves || '').split(' ').filter(Boolean);
      const nodes = buildTreeFromMoves(moves);
      treeRef.current = nodes;
      setTreeNodes(nodes);
      const targetDepth = s.board_move_index || 0;
      let targetId = 'root';
      let c = nodes['root']?.childIds?.[0]; let d = 0;
      while (c && d < targetDepth) { targetId = c; c = nodes[c]?.childIds?.[0]; d++; }
      chess.reset();
      getPathFromRoot(targetId, nodes).forEach(id => { if (nodes[id]?.san) try { chess.move(nodes[id].san); } catch {} });
      setFen(chess.fen());
      setCurrentNodeId(targetId);
      setChatHistory(s.chat_history || []);
      setNotes(s.notes || {});
      setNoteInput((s.notes || {})[targetId] || '');
      setCurrentSessionId(sid);
      setShowSessions(false);
      setSelectedSq(null);
      setLegalTargets([]);
      // Suppress auto-explain when restoring a session
      justSelectedRef.current = true;
      setTimeout(() => { justSelectedRef.current = false; }, 5000);
    } catch {}
  }

  async function deleteSession(sid) {
    try {
      await fetch(`${API}/coach/session/${sid}?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sid));
    } catch {}
  }

  /* ── Theory move arrow (next main-line book move) ─────── */
  const theoryArrow = (() => {
    const curNode = treeNodes[currentNodeId];
    if (!curNode) return null;
    const nextMainId = curNode.childIds?.find(id => treeNodes[id]?.isMainLine);
    if (!nextMainId) return null;
    const nextNode = treeNodes[nextMainId];
    if (!nextNode?.san) return null;
    try {
      const tmp = new Chess(curNode.fen);
      const r = tmp.move(nextNode.san);
      if (!r) return null;
      return [r.from, r.to, 'rgba(52,211,153,1.0)'];
    } catch { return null; }
  })();

  /* ── Stockfish arrows — legal moves only, theory square excluded ── */
  const stockfishArrows = useMemo(() => {
    if (!topMoves.some(Boolean)) return [];
    try {
      const chk = new Chess(fen);
      const legal = new Set(chk.moves({ verbose: true }).map(m => m.from + m.to));
      // If the theory arrow covers the same squares, skip that Stockfish entry
      // so the green arrow is never overridden by a yellow duplicate
      const theoryKey = theoryArrow ? theoryArrow[0] + theoryArrow[1] : null;
      return topMoves
        .slice(0, 5)
        .filter(m => m && legal.has(m.from + m.to) && m.from + m.to !== theoryKey)
        .map((m, i) => [m.from, m.to, arrowColors[i]]);
    } catch { return []; }
  }, [topMoves, fen, arrowColors, theoryArrow]);

  /* ── Position stats from game history ─────────────────── */
  const [positionStats, setPositionStats] = useState(null);
  useEffect(() => {
    if (!fen || !username) return;
    setPositionStats(null);
    fetch(`${API}/position-stats?fen=${encodeURIComponent(fen)}&username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => setPositionStats(d))
      .catch(() => {});
  }, [fen, username]);

  /* ── Derived ───────────────────────────────────────────── */
  const curNode      = treeNodes[currentNodeId];
  const hasPrev      = currentNodeId !== 'root';
  const hasNext      = (curNode?.childIds?.length || 0) > 0;
  const firstMainId  = treeNodes['root']?.childIds?.[0];

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="oc-root">
      {/* Header */}
      <div className="oc-header">
        <div className="oc-title-row">
          <div className="oc-title">
            <span className="oc-glyph">♟</span>
            <div>
              <div className="oc-title-main">AI Opening Coach</div>
              <div className="oc-title-sub">Powered by Groq · 3,690 openings</div>
            </div>
          </div>
          <div className="oc-session-btns">
            <button className="oc-btn-ghost" onClick={() => { loadSessionList(); setShowSessions(s => !s); }}>📂 Sessions</button>
            <button className="oc-btn-primary" onClick={saveSession} disabled={!selectedOpening}>{saveStatus || '💾 Save'}</button>
            {currentSessionId && <span className="oc-session-id">#{currentSessionId}</span>}
          </div>
        </div>
        <div className="oc-search-wrap" ref={searchRef}>
          <div className="oc-search-box">
            <span className="oc-search-icon">⌕</span>
            <input
              className="oc-search-input"
              placeholder="Search an opening e.g. sic, kings indian, ruy lopez"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(e.target.value.length >= 2); }}
              onFocus={() => !selectedOpening && query.length >= 2 && setShowDropdown(true)}
            />
            {query && <button className="oc-search-clear" onClick={() => { setQuery(''); setShowDropdown(false); }}>✕</button>}
          </div>
          {showDropdown && results.length > 0 && (
            <ul className="oc-dropdown">
              {results.map(o => (
                <li key={o.eco + o.name} onClick={() => selectOpening(o)}>
                  <span className="oc-eco">{o.eco}</span>
                  <span className="oc-name">{o.name}</span>
                  <span className="oc-moves-preview">{o.pgn}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Sessions drawer */}
      {showSessions && (
        <div className="oc-sessions-drawer">
          <div className="oc-sessions-head">
            Saved Sessions
            <button className="oc-sessions-close" onClick={() => setShowSessions(false)}>✕</button>
          </div>
          {sessions.length === 0
            ? <div className="oc-sessions-empty">No sessions saved yet.</div>
            : sessions.map(s => (
              <div key={s.id} className="oc-session-row">
                <div className="oc-session-info" onClick={() => loadSession(s.id)}>
                  <span className="oc-session-eco">{s.opening_eco}</span>
                  <span className="oc-session-name">{s.opening_name}</span>
                  <span className="oc-session-date">{new Date(s.updated_at).toLocaleDateString()}</span>
                </div>
                <button className="oc-session-del" onClick={() => deleteSession(s.id)}>✕</button>
              </div>
            ))
          }
        </div>
      )}

      {/* ── Recent sessions strip (below search, full width) ── */}
      {!selectedOpening && sessions.length > 0 && (
        <div className="oc-sessions-strip">
          <span className="oc-strip-label">Recent sessions</span>
          <div className="oc-strip-cards">
            {sessions.map(s => (
              <div key={s.id} className="oc-strip-card" onClick={() => loadSession(s.id)}>
                <div className="oc-strip-card-top">
                  <span className="oc-esc-eco">{s.opening_eco}</span>
                  <button className="oc-esc-del" onClick={e => { e.stopPropagation(); deleteSession(s.id); }}>✕</button>
                </div>
                <div className="oc-strip-card-name">{s.opening_name}</div>
                <div className="oc-strip-card-date">{new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!selectedOpening ? (
        <div className="oc-empty">
          <div className="oc-empty-glyph">♜</div>
          <div className="oc-empty-title">Search an opening to begin</div>
          <div className="oc-empty-sub">Type a name above — e.g. "sicilian", "ruy lopez", "king's indian"</div>
        </div>
      ) : (
        <div className="oc-body" style={{ gridTemplateColumns: isMobile ? '1fr' : (chatOpen ? '430px 1fr' : '1fr 44px') }}>
          {/* LEFT */}
          <div className="oc-left">
            <div className="oc-opening-badge">
              <span className="oc-badge-eco">{selectedOpening.eco}</span>
              <span className="oc-badge-name">{selectedOpening.name}</span>
            </div>

            <div className="oc-board-row">
              <EvalBar evalScore={evalScore} flipped={boardFlipped} />
              <div className="oc-board-wrap">
                <Chessboard
                  position={fen}
                  boardOrientation={boardFlipped ? 'black' : 'white'}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  customSquareStyles={customSquareStyles}
                  customPieces={CHESS_PIECES}
                  customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
                  customLightSquareStyle={{ backgroundColor: boardColors.light }}
                  customArrows={[...stockfishArrows, ...(theoryArrow ? [theoryArrow] : [])]}

                  boardWidth={isMobile ? Math.min(window.innerWidth - 68, 310) : (chatOpen ? 360 : 460)}
                />
              </div>
            </div>

            {/* Move tree nav */}
            <div className="oc-move-nav">
              <button className="oc-nav-btn" onClick={() => goToNode('root')} disabled={!hasPrev} title="Start">⟨⟨</button>
              <button className="oc-nav-btn" onClick={stepBack}    disabled={!hasPrev} title="Back">⟨</button>
              <div className="oc-movelist">
                {firstMainId
                  ? <MoveLine startId={firstMainId} nodes={treeNodes} curId={currentNodeId} onGoTo={goToNode} />
                  : <span className="oc-ml-empty">Make moves on the board</span>
                }
              </div>
              <button className="oc-nav-btn" onClick={stepForward} disabled={!hasNext} title="Forward">⟩</button>
              <button className="oc-nav-btn" onClick={goToEnd}     disabled={!hasNext} title="End">⟩⟩</button>
              <button className="oc-flip-btn" onClick={() => setBoardFlipped(f => !f)} title="Flip board">⇅</button>
            </div>

            {/* Position stats strip */}
            {positionStats !== null && (
              <div className="oc-pos-strip">
                {positionStats.games === 0 ? (
                  <span className="oc-pos-strip-empty">No games from this position yet</span>
                ) : (
                  <>
                    <span className="oc-pos-strip-label">{positionStats.games} games</span>
                    <span className="oc-pos-strip-sep" />
                    <span className="oc-pos-strip-w">W {Math.round(positionStats.wins / positionStats.games * 100)}%</span>
                    <span className="oc-pos-strip-d">D {Math.round(positionStats.draws / positionStats.games * 100)}%</span>
                    <span className="oc-pos-strip-l">L {Math.round(positionStats.losses / positionStats.games * 100)}%</span>
                  </>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="oc-notes-panel">
              <div className="oc-notes-label">
                ✎ Note {curNode?.san ? `— Move ${curNode.depth} (${curNode.san})` : '(select a move)'}
              </div>
              <textarea
                className="oc-notes-input"
                placeholder="Write your notes here..."
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                disabled={currentNodeId === 'root'}
                rows={3}
              />
              <button className="oc-notes-save" onClick={saveNote} disabled={currentNodeId === 'root'}>Save note</button>
            </div>
          </div>

          {/* RIGHT: Chat (collapsible) */}
          <div className={`oc-right${chatOpen ? '' : ' oc-right-collapsed'}`}>
            <div className="oc-chat-head">
              {chatOpen && (
                <div className="oc-chat-head-text">
                  <span className="oc-chat-title">Coach</span>
                  <span className="oc-chat-sub">Ask anything about {selectedOpening.name}</span>
                </div>
              )}
              <button
                className="oc-chat-toggle"
                onClick={() => setChatOpen(o => !o)}
                title={chatOpen ? 'Collapse chat' : 'Expand chat'}
              >
                {chatOpen ? '›' : '‹'}
              </button>
            </div>
            {chatOpen && (
              <>
                {/* Engine chips above chat */}
                {analysisFen && (() => {
                  const CHIP_COLORS = ['#a78bfa', '#34d399', '#fbbf24', '#60a5fa'];
                  const legalSet = (() => {
                    try { return new Set(new Chess(fen).moves({ verbose: true }).map(m => m.from + m.to)); }
                    catch { return new Set(); }
                  })();
                  const validMoves = topMoves.filter(m => m && legalSet.has(m.from + m.to)).slice(0, 4);
                  return (
                    <div className="oc-engine-chips">
                      {validMoves.length === 0
                        ? <span className="oc-engine-chips-loading">Analysing…</span>
                        : validMoves.map((mv, i) => {
                            let san = mv.from + mv.to;
                            try {
                              const tmp = new Chess(fen);
                              const r = tmp.move({ from: mv.from, to: mv.to, promotion: 'q' });
                              if (r) san = r.san;
                            } catch {}
                            const scoreStr = mv.score == null ? '' : mv.score >= 99 ? '#' : mv.score <= -99 ? '-#'
                              : (mv.score >= 0 ? '+' : '') + mv.score.toFixed(2);
                            return (
                              <button key={i} className="oc-engine-chip"
                                style={{ '--chip-col': CHIP_COLORS[i] }}
                                onClick={() => makeMove(mv.from, mv.to)}>
                                <span className="oc-engine-chip-san">{san}</span>
                                {scoreStr && <span className="oc-engine-chip-score">{scoreStr}</span>}
                              </button>
                            );
                          })}
                    </div>
                  );
                })()}

                <div className="oc-chat-messages">
                  {chatHistory.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
                  {streamBuffer && (
                    <div className="oc-msg oc-msg-assistant">
                      <div className="oc-msg-avatar">♟</div>
                      <div className="oc-msg-bubble oc-msg-streaming">
                        {streamBuffer.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                        <span className="oc-cursor">▌</span>
                      </div>
                    </div>
                  )}
                  {isStreaming && !streamBuffer && (
                    <div className="oc-msg oc-msg-assistant">
                      <div className="oc-msg-avatar">♟</div>
                      <div className="oc-msg-bubble oc-thinking"><span /><span /><span /></div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="oc-chat-input-row">
                  <textarea
                    className="oc-chat-input"
                    placeholder="Ask the coach e.g. Why is Nf3 played on move 3?"
                    value={inputMsg}
                    onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={handleInputKey}
                    rows={2}
                    disabled={isStreaming}
                  />
                  <button className="oc-send-btn" onClick={handleSend} disabled={isStreaming || !inputMsg.trim()}>
                    {isStreaming ? '…' : '↑'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
