import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AccountSettings.css';

const SOURCES = [
  { id: 'chess.com', label: 'Chess.com' },
  { id: 'lichess',   label: 'Lichess'   },
];

export default function AccountSettings({ onClose, onChessUsernameChanged }) {
  const { user, profile, updateProfile, signOut } = useAuth();
  const [chessUsername, setChessUsername] = useState(profile?.chess_username || '');
  const [chessSource,   setChessSource]   = useState(profile?.chess_source   || 'chess.com');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (!chessUsername.trim()) return;
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateProfile(chessUsername.trim(), chessSource);
      setSuccess(true);
      onChessUsernameChanged?.(chessUsername.trim(), chessSource);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    // App.js auth listener will detect the logout and go back to login screen
  }

  return (
    <div className="as-overlay" onClick={onClose}>
      <div className="as-modal" onClick={e => e.stopPropagation()}>
        <div className="as-header">
          <span className="as-title">Account</span>
          <button className="as-close" onClick={onClose}>✕</button>
        </div>

        {/* Google identity */}
        <div className="as-identity">
          <img
            src={user?.user_metadata?.avatar_url}
            alt=""
            className="as-avatar"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="as-real-name">{user?.user_metadata?.full_name}</div>
            <div className="as-email">{user?.email}</div>
          </div>
        </div>

        <div className="as-divider" />

        {/* Chess account */}
        <form onSubmit={handleSave} className="as-form">
          <div className="as-label">Chess platform</div>
          <div className="as-source-row">
            {SOURCES.map(s => (
              <button key={s.id} type="button"
                className={`as-source-btn ${chessSource === s.id ? 'as-source-active' : ''}`}
                onClick={() => setChessSource(s.id)}
              >{s.label}</button>
            ))}
          </div>

          <div className="as-label" style={{ marginTop: 12 }}>
            {chessSource === 'chess.com' ? 'Chess.com' : 'Lichess'} username
          </div>
          <input
            className="as-input"
            value={chessUsername}
            onChange={e => setChessUsername(e.target.value)}
            placeholder="Your username"
            disabled={saving}
          />

          {error   && <div className="as-error">{error}</div>}
          {success && <div className="as-success">Saved!</div>}

          <button type="submit" className="as-save-btn" disabled={saving || !chessUsername.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <div className="as-divider" />

        <button className="as-signout-btn" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
