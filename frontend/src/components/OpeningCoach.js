import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors } from '../contexts/ThemeContext';
import { CHESS_PIECES } from './boardPieces';
import openingsData from '../data/openings.json';
import './OpeningCoach.css';

const API = 'http://localhost:8000';
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
      <div className="oc-eval-lbl">{topWins ? lbl : ''}</div>
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
      <div className="oc-eval-lbl">{botWins ? lbl : ''}</div>
    </div>
  );
}

/* ── ChatMessage ─────────────────────────────────────────── */
function ChatMessage({ msg }) {
  return (
    <div className={`oc-msg oc-msg-${msg.role}`}>
      <div className="oc-msg-avatar">{msg.role === 'assistant' ? '♟' : '?'}</div>
      <div className="oc-msg-bubble">
        {msg.content.split('\n').map((l, i) => <p key={i}>{l}</p>)}
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
export default function OpeningCoach({ username, playerProfile }) {
  const boardColors = useBoardColors();

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

  const [evalScore, setEvalScore] = useState(null);
  const engineRef      = useRef(null);
  const engineReadyRef = useRef(false);
  const pendingFenRef  = useRef(null);
  const lastEvalFenRef        = useRef(START_FEN);
  const sendMessageRef        = useRef(null);
  const isStreamingRef        = useRef(false);
  const chatHistoryRef        = useRef([]);
  const justSelectedRef        = useRef(false);
  const autoExplainDebounceRef = useRef(null);
  const lastAutoExplainRef     = useRef(0);

  useEffect(() => { treeRef.current      = treeNodes;   }, [treeNodes]);
  useEffect(() => { notesRef.current     = notes;       }, [notes]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);
  useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);

  /* ── Stockfish ─────────────────────────────────────────── */
  useEffect(() => {
    let engine;
    try { engine = new Worker(`${process.env.PUBLIC_URL}/stockfish-18-lite-single.js`); }
    catch { return; }
    engineRef.current = engine;
    engineReadyRef.current = false;
    engine.onerror = () => {};
    engine.onmessage = (e) => {
      const line = typeof e.data === 'string' ? e.data : '';
      if (line === 'uciok') { engine.postMessage('ucinewgame'); engine.postMessage('isready'); return; }
      if (line === 'readyok') {
        engineReadyRef.current = true;
        if (pendingFenRef.current) {
          engine.postMessage(`position fen ${pendingFenRef.current}`);
          engine.postMessage('go depth 14');
          pendingFenRef.current = null;
        }
        return;
      }
      const cp = line.match(/score cp (-?\d+)/);
      const mt = line.match(/score mate (-?\d+)/);
      if (cp) {
        const turn = lastEvalFenRef.current.split(' ')[1];
        const raw  = parseInt(cp[1]);
        setEvalScore(parseFloat(((turn === 'b' ? -raw : raw) / 100).toFixed(1)));
      } else if (mt) {
        const turn = lastEvalFenRef.current.split(' ')[1];
        const m    = parseInt(mt[1]);
        const norm = turn === 'b' ? -m : m;
        setEvalScore(norm > 0 ? 99 : -99);
      }
    };
    engine.postMessage('uci');
    return () => { engine.postMessage('quit'); engine.terminate(); };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setEvalScore(null);
    engine.postMessage('stop');
    lastEvalFenRef.current = fen;
    if (engineReadyRef.current) {
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage('go depth 14');
    } else { pendingFenRef.current = fen; }
  }, [fen]);

  /* ── Search ────────────────────────────────────────────── */
  useEffect(() => { setResults(searchOpenings(query)); }, [query]);
  useEffect(() => {
    function h(e) { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Auto-explain on move navigation ──────────────────── */
  useEffect(() => {
    if (currentNodeId === 'root' || !selectedOpening) return;
    if (justSelectedRef.current) return;
    const node = treeRef.current[currentNodeId];
    if (!node?.san) return;

    if (autoExplainDebounceRef.current) clearTimeout(autoExplainDebounceRef.current);
    autoExplainDebounceRef.current = setTimeout(() => {
      if (isStreamingRef.current) return;
      // Rate-limit: at most one auto-explain every 4 seconds
      const now = Date.now();
      if (now - lastAutoExplainRef.current < 4000) return;
      lastAutoExplainRef.current = now;
      const side = node.depth % 2 === 1 ? 'White' : 'Black';
      const moveNum = Math.ceil(node.depth / 2);
      const moveLine = getPathFromRoot(currentNodeId, treeRef.current)
        .map(id => treeRef.current[id]?.san).filter(Boolean).join(' ');
      const prompt = `${side} just played ${node.san} (move ${moveNum}). In 2–3 short paragraphs explain: why this specific move is played here, what strategic idea it follows or prepares, and what both sides should be thinking about next.`;
      sendMessageRef.current(prompt, chatHistoryRef.current, selectedOpening, moveLine);
    }, 700);
  }, [currentNodeId, selectedOpening]); // eslint-disable-line

  /* ── goToNode ──────────────────────────────────────────── */
  const goToNode = useCallback((nodeId, nodesOverride) => {
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
  const selectOpening = useCallback((opening) => {
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
    const intro = `Tell me about the ${opening.name}. Start with your introduction and assessment.`;
    setChatHistory([]);
    setStreamBuffer('');
    setIsStreaming(false);
    justSelectedRef.current = true;
    setTimeout(() => {
      sendMessageRef.current(intro, [], opening, moves.join(' '));
      // Re-enable auto-explain once the intro response lands (5s safety window)
      setTimeout(() => { justSelectedRef.current = false; }, 5000);
    }, 0);
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

  /* ── Derived ───────────────────────────────────────────── */
  const winStats = playerProfile
    ? Object.entries(playerProfile.time_controls || {})
        .filter(([, v]) => v.games > 0)
        .map(([k, v]) => ({ label: k, rate: v.win_rate || 0 }))
    : [];
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
              <div className="oc-title-sub">Powered by Claude · 3,690 openings</div>
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

      {!selectedOpening ? (
        <div className="oc-empty">
          <div className="oc-empty-glyph">♜</div>
          <div className="oc-empty-title">Search an opening to begin</div>
          <div className="oc-empty-sub">Type a name above — e.g. "sicilian", "ruy lopez", "king's indian"</div>

          {sessions.length > 0 && (
            <div className="oc-empty-sessions">
              <div className="oc-empty-sessions-title">Continue a session</div>
              <div className="oc-empty-sessions-grid">
                {sessions.map(s => (
                  <div key={s.id} className="oc-empty-session-card" onClick={() => loadSession(s.id)}>
                    <div className="oc-esc-top">
                      <span className="oc-esc-eco">{s.opening_eco}</span>
                      <button className="oc-esc-del" onClick={e => { e.stopPropagation(); deleteSession(s.id); }}>✕</button>
                    </div>
                    <div className="oc-esc-name">{s.opening_name}</div>
                    <div className="oc-esc-date">{new Date(s.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="oc-body">
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
                  boardWidth={400}
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

            {winStats.length > 0 && (
              <div className="oc-stats-panel">
                <div className="oc-stats-label">Your Win Rates</div>
                {winStats.map(({ label, rate }) => (
                  <WinBar key={label} label={label} rate={rate}
                    color={rate >= 55 ? 'var(--green)' : rate < 40 ? 'var(--gold)' : 'rgba(255,255,255,0.4)'} />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Chat */}
          <div className="oc-right">
            <div className="oc-chat-head">
              <span className="oc-chat-title">Coach</span>
              <span className="oc-chat-sub">Ask anything about {selectedOpening.name}</span>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
