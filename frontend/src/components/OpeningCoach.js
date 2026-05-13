import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardColors } from '../contexts/ThemeContext';
import { CHESS_PIECES } from './boardPieces';
import openingsData from '../data/openings.json';
import './OpeningCoach.css';

const API = 'http://localhost:8000';

// ── Opening search helpers ──────────────────────────────
function searchOpenings(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return openingsData
    .filter(o => o.name.toLowerCase().includes(q))
    .slice(0, 12);
}

// ── Win-rate bar ─────────────────────────────────────────
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

// ── Chat message ─────────────────────────────────────────
function ChatMessage({ msg }) {
  return (
    <div className={`oc-msg oc-msg-${msg.role}`}>
      <div className="oc-msg-avatar">{msg.role === 'assistant' ? '♟' : '?'}</div>
      <div className="oc-msg-bubble">
        {msg.content.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function OpeningCoach({ username, playerProfile }) {
  const boardColors = useBoardColors();

  // Search
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState(null);
  const searchRef = useRef(null);

  // Board
  const [chess]            = useState(() => new Chess());
  const [fen, setFen]      = useState(chess.fen());
  const [moveList, setMoveList] = useState([]);   // SAN array from opening
  const [moveIdx, setMoveIdx]  = useState(-1);    // current position in moveList

  // Chat
  const [chatHistory, setChatHistory]   = useState([]);  // [{role,content}]
  const [inputMsg, setInputMsg]         = useState('');
  const [isStreaming, setIsStreaming]   = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const chatEndRef = useRef(null);

  // Notes
  const [notes, setNotes]           = useState({});  // {moveIdx: string}
  const [noteInput, setNoteInput]   = useState('');

  // Sessions
  const [sessions, setSessions]         = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [saveStatus, setSaveStatus]     = useState('');

  // ── Search ──────────────────────────────────────────────
  useEffect(() => {
    setResults(searchOpenings(query));
    setShowDropdown(query.length >= 2);
  }, [query]);

  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Select opening ──────────────────────────────────────
  const selectOpening = useCallback((opening) => {
    setSelectedOpening(opening);
    setQuery(opening.name);
    setShowDropdown(false);

    // Reset board
    chess.reset();
    setFen(chess.fen());

    // Parse moves
    const moves = opening.moves ? opening.moves.split(' ').filter(Boolean) : [];
    setMoveList(moves);
    setMoveIdx(-1);
    setNotes({});
    setNoteInput('');
    setCurrentSessionId(null);

    // Kick off AI intro (first message)
    startSession(opening, moves);
  }, [chess]); // eslint-disable-line

  // ── Board navigation ────────────────────────────────────
  const goToMove = useCallback((targetIdx) => {
    chess.reset();
    for (let i = 0; i <= targetIdx && i < moveList.length; i++) {
      try { chess.move(moveList[i]); } catch {}
    }
    setFen(chess.fen());
    setMoveIdx(targetIdx);
    setNoteInput(notes[targetIdx] || '');
  }, [chess, moveList, notes]);

  const stepBack = () => goToMove(Math.max(-1, moveIdx - 1));
  const stepForward = () => goToMove(Math.min(moveList.length - 1, moveIdx + 1));

  useEffect(() => {
    function handleKey(e) {
      if (!selectedOpening) return;
      if (e.key === 'ArrowLeft')  stepBack();
      if (e.key === 'ArrowRight') stepForward();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedOpening, moveIdx, moveList]); // eslint-disable-line

  // ── Chat scroll ─────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamBuffer]);

  // ── Start session (intro message) ───────────────────────
  async function startSession(opening, moves) {
    setChatHistory([]);
    setStreamBuffer('');
    const intro = `Tell me about the ${opening.name}. Start with your introduction and assessment.`;
    await sendMessage(intro, [], opening, moves.join(' '));
  }

  // ── Send message ─────────────────────────────────────────
  async function sendMessage(userText, history, opening, movesStr) {
    const op = opening || selectedOpening;
    const ms = movesStr !== undefined ? movesStr : moveList.join(' ');
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
          username,
          opening_name: op.name,
          opening_eco:  op.eco,
          opening_moves: ms,
          chat_history: history,
          user_message: userText,
          player_profile: playerProfile || null,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamBuffer(fullText);
      }

      setChatHistory(prev => [...prev, { role: 'assistant', content: fullText }]);
      setStreamBuffer('');
    } catch (err) {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting. Please try again.',
      }]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSend() {
    if (!inputMsg.trim() || isStreaming || !selectedOpening) return;
    sendMessage(inputMsg.trim(), chatHistory);
  }

  function handleInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Notes ────────────────────────────────────────────────
  function saveNote() {
    if (moveIdx < 0) return;
    setNotes(prev => ({ ...prev, [moveIdx]: noteInput }));
  }

  // ── Sessions ─────────────────────────────────────────────
  async function loadSessionList() {
    try {
      const res = await fetch(`${API}/coach/sessions?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {}
  }

  async function saveSession() {
    if (!selectedOpening) return;
    setSaveStatus('saving…');
    try {
      const res = await fetch(`${API}/coach/session/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          opening_name: selectedOpening.name,
          opening_eco:  selectedOpening.eco,
          opening_moves: moveList.join(' '),
          chat_history: chatHistory,
          board_move_index: moveIdx,
          notes,
          session_id: currentSessionId || null,
        }),
      });
      const data = await res.json();
      setCurrentSessionId(data.session_id);
      setSaveStatus('saved ✓');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch {
      setSaveStatus('error');
    }
  }

  async function loadSession(sid) {
    try {
      const res = await fetch(`${API}/coach/session/${sid}?username=${encodeURIComponent(username)}`);
      const s = await res.json();

      const opening = openingsData.find(o => o.name === s.opening_name) || {
        name: s.opening_name, eco: s.opening_eco, moves: s.opening_moves,
      };
      setSelectedOpening(opening);
      setQuery(opening.name);

      const moves = (s.opening_moves || '').split(' ').filter(Boolean);
      setMoveList(moves);

      chess.reset();
      const idx = s.board_move_index || -1;
      for (let i = 0; i <= idx && i < moves.length; i++) {
        try { chess.move(moves[i]); } catch {}
      }
      setFen(chess.fen());
      setMoveIdx(idx);
      setChatHistory(s.chat_history || []);
      setNotes(s.notes || {});
      setNoteInput((s.notes || {})[idx] || '');
      setCurrentSessionId(sid);
      setShowSessions(false);
    } catch {}
  }

  async function deleteSession(sid) {
    try {
      await fetch(`${API}/coach/session/${sid}?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== sid));
    } catch {}
  }

  // ── Render ────────────────────────────────────────────────
  const displayedMoves = moveList.map((m, i) => ({ san: m, idx: i }));

  // Compute win-rate data from playerProfile
  const winStats = playerProfile ? (() => {
    const tc = playerProfile.time_controls || {};
    return Object.entries(tc)
      .filter(([, v]) => v.games > 0)
      .map(([k, v]) => ({ label: k, rate: v.win_rate || 0 }));
  })() : [];

  return (
    <div className="oc-root">
      {/* ── HEADER / SEARCH ── */}
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
            <button className="oc-btn-ghost" onClick={() => { loadSessionList(); setShowSessions(s => !s); }}>
              📂 Sessions
            </button>
            <button className="oc-btn-primary" onClick={saveSession} disabled={!selectedOpening}>
              {saveStatus || '💾 Save'}
            </button>
            {currentSessionId && <span className="oc-session-id">#{currentSessionId}</span>}
          </div>
        </div>

        {/* Search bar */}
        <div className="oc-search-wrap" ref={searchRef}>
          <div className="oc-search-box">
            <span className="oc-search-icon">⌕</span>
            <input
              className="oc-search-input"
              placeholder="Search an opening e.g. sic, kings indian, ruy lopez"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => query.length >= 2 && setShowDropdown(true)}
            />
            {query && (
              <button className="oc-search-clear" onClick={() => { setQuery(''); setShowDropdown(false); }}>✕</button>
            )}
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

      {/* ── SESSIONS DRAWER ── */}
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

      {/* ── MAIN PANE ── */}
      {!selectedOpening ? (
        <div className="oc-empty">
          <div className="oc-empty-glyph">♜</div>
          <div className="oc-empty-title">Search an opening to begin</div>
          <div className="oc-empty-sub">Type a name above — e.g. "sicilian", "ruy lopez", "king's indian"</div>
        </div>
      ) : (
        <div className="oc-body">

          {/* LEFT: Board + moves + stats */}
          <div className="oc-left">
            <div className="oc-opening-badge">
              <span className="oc-badge-eco">{selectedOpening.eco}</span>
              <span className="oc-badge-name">{selectedOpening.name}</span>
            </div>

            <div className="oc-board-wrap">
              <Chessboard
                position={fen}
                arePiecesDraggable={false}
                customPieces={CHESS_PIECES}
                customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
                customLightSquareStyle={{ backgroundColor: boardColors.light }}
                boardWidth={320}
              />
            </div>

            {/* Move strip */}
            <div className="oc-move-nav">
              <button className="oc-nav-btn" onClick={() => goToMove(-1)} disabled={moveIdx < 0}>⟨⟨</button>
              <button className="oc-nav-btn" onClick={stepBack} disabled={moveIdx < 0}>⟨</button>
              <div className="oc-move-strip">
                {displayedMoves.map(({ san, idx }) => (
                  <button
                    key={idx}
                    className={`oc-move-chip ${idx === moveIdx ? 'active' : ''} ${notes[idx] ? 'has-note' : ''}`}
                    onClick={() => goToMove(idx)}
                    title={notes[idx] ? `Note: ${notes[idx]}` : ''}
                  >
                    {idx % 2 === 0 ? `${Math.floor(idx / 2) + 1}.` : ''}{san}
                    {notes[idx] && <span className="oc-note-dot">●</span>}
                  </button>
                ))}
              </div>
              <button className="oc-nav-btn" onClick={stepForward} disabled={moveIdx >= moveList.length - 1}>⟩</button>
              <button className="oc-nav-btn" onClick={() => goToMove(moveList.length - 1)} disabled={moveIdx >= moveList.length - 1}>⟩⟩</button>
            </div>

            {/* Notes for current move */}
            <div className="oc-notes-panel">
              <div className="oc-notes-label">
                ✎ Note {moveIdx >= 0 ? `— Move ${moveIdx + 1} (${moveList[moveIdx]})` : '(select a move)'}
              </div>
              <textarea
                className="oc-notes-input"
                placeholder="Write your notes here..."
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                disabled={moveIdx < 0}
                rows={3}
              />
              <button className="oc-notes-save" onClick={saveNote} disabled={moveIdx < 0}>
                Save note
              </button>
            </div>

            {/* Win stats */}
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
              {chatHistory.map((msg, i) => (
                <ChatMessage key={i} msg={msg} />
              ))}
              {streamBuffer && (
                <div className="oc-msg oc-msg-assistant">
                  <div className="oc-msg-avatar">♟</div>
                  <div className="oc-msg-bubble oc-msg-streaming">
                    {streamBuffer.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                    <span className="oc-cursor">▌</span>
                  </div>
                </div>
              )}
              {isStreaming && !streamBuffer && (
                <div className="oc-msg oc-msg-assistant">
                  <div className="oc-msg-avatar">♟</div>
                  <div className="oc-msg-bubble oc-thinking">
                    <span /><span /><span />
                  </div>
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
              <button
                className="oc-send-btn"
                onClick={handleSend}
                disabled={isStreaming || !inputMsg.trim()}
              >
                {isStreaming ? '…' : '↑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
