import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './LandingPage';
import './LoginPage.css';

const SOURCES = [
  { id: 'chess.com',  label: 'Chess.com' },
  { id: 'lichess',    label: 'Lichess'   },
];

export default function LoginPage({ onLoginSuccess }) {
  const { signInWithGoogle, user, profile, updateProfile } = useAuth();
  const [signingIn, setSigningIn]     = useState(false);
  const [error, setError]             = useState('');

  // Step 2: after Google auth, user hasn't set Chess.com username yet
  const [chessUsername, setChessUsername] = useState('');
  const [chessSource, setChessSource]     = useState('chess.com');
  const [saving, setSaving]               = useState(false);

  // If user is already signed in and has a chess username, call success
  React.useEffect(() => {
    if (user && profile && profile.chess_username) {
      onLoginSuccess(profile.chess_username, profile.chess_source || 'chess.com');
    }
  }, [user, profile, onLoginSuccess]);

  async function handleGoogleSignIn() {
    setError('');
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // page will redirect → return; nothing more to do here
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
      setSigningIn(false);
    }
  }

  async function handleSaveChessUsername(e) {
    e.preventDefault();
    if (!chessUsername.trim()) { setError('Please enter a username'); return; }
    setSaving(true);
    setError('');
    try {
      await updateProfile(chessUsername.trim(), chessSource);
      onLoginSuccess(chessUsername.trim(), chessSource);
    } catch (err) {
      setError(err.message || 'Could not save profile');
      setSaving(false);
    }
  }

  // ── Step 2: user just signed in with Google but has no chess username yet ──
  if (user && profile && !profile.chess_username) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-avatar-row">
            <img
              src={user.user_metadata?.avatar_url}
              alt=""
              className="login-google-avatar"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="login-google-name">{user.user_metadata?.full_name}</div>
              <div className="login-google-email">{user.email}</div>
            </div>
          </div>

          <h2 className="login-step2-title">Link your Chess account</h2>
          <p className="login-subtitle">Enter the username you play on so we can import your games.</p>

          <form onSubmit={handleSaveChessUsername} className="login-form">
            <div className="login-source-row">
              {SOURCES.map(s => (
                <button key={s.id} type="button"
                  className={`login-source-btn ${chessSource === s.id ? 'login-source-active' : ''}`}
                  onClick={() => setChessSource(s.id)}
                >{s.label}</button>
              ))}
            </div>

            <div className="form-group">
              <label htmlFor="chess-username">{chessSource === 'chess.com' ? 'Chess.com' : 'Lichess'} Username</label>
              <input
                id="chess-username"
                type="text"
                value={chessUsername}
                onChange={e => setChessUsername(e.target.value)}
                placeholder={`Your ${chessSource === 'chess.com' ? 'Chess.com' : 'Lichess'} username`}
                autoFocus
                disabled={saving}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-button" disabled={saving || !chessUsername.trim()}>
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 1: not signed in yet ──
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo-row">
          <Logo size={40} />
        </div>
        <h1 className="login-title">Chess Coach</h1>
        <p className="login-subtitle">AI-Powered Opening & Position Training</p>

        {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

        <button
          className="login-google-btn"
          onClick={handleGoogleSignIn}
          disabled={signingIn}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" className="login-google-icon">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.3 30.2 0 24 0 14.7 0 6.7 5.4 2.8 13.3l7.9 6.1C12.5 13 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.8-2.1 5.2-4.5 6.8l7 5.4c4.1-3.8 6.5-9.4 6.5-16.2z"/>
            <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.8 10.7l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7-5.4c-2 1.3-4.6 2.1-8.2 2.1-6.2 0-11.5-4.2-13.4-9.8l-7.9 6.1C6.7 42.6 14.7 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          {signingIn ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="login-divider"><span>Your data stays yours</span></div>

        <div className="login-info">
          <h3>How it works:</h3>
          <ol>
            <li>Sign in with your Google account</li>
            <li>Link your Chess.com or Lichess username</li>
            <li>Access your sessions from any device</li>
            <li>Train with AI coaching</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
