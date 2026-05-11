import React, { useState } from 'react';
import axios from 'axios';
import './LoginPage.css';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'register'

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const endpoint = mode === 'login' ? '/login' : '/register';
      const response = await axios.post(`http://localhost:8000${endpoint}`, {
        username: username.trim(),
      });

      if (response.data.success) {
        // Store username and token in localStorage
        localStorage.setItem('username', username.trim());
        localStorage.setItem('token', response.data.token);
        onLoginSuccess(username.trim());
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Connection error. Make sure backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Chess Coach</h1>
        <p className="login-subtitle">AI-Powered Opening & Position Training</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Chess.com Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your Chess.com username"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={isLoading}
            className="submit-button"
          >
            {isLoading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mode-toggle">
          <p>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="toggle-button"
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>

        <div className="login-info">
          <h3>How it works:</h3>
          <ol>
            <li>Enter your Chess.com username</li>
            <li>We'll analyze your games</li>
            <li>Get personalized opening recommendations</li>
            <li>Train with AI coaching</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
