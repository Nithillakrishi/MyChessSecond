import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import GameImporter from './components/GameImporter';
import Questionnaire from './components/Questionnaire';
import OpeningCoach from './components/OpeningCoach';
import LandingPage, { Logo } from './components/LandingPage';
import LoginPage from './components/LoginPage';
import AppLayout from './components/AppLayout';
import WelcomePage from './components/WelcomePage';
import PlayVsStockfish from './components/PlayVsStockfish';
import CustomPosition from './components/CustomPosition';
import ChessExplorer from './components/ChessExplorer';
import EngineTraining from './components/EngineTraining';
import TrainVsPlayer from './components/TrainVsPlayer';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import axios from 'axios';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function extractError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return JSON.stringify(detail);
}

function AppInner() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive step and activeMode from URL — URL is source of truth
  const path = location.pathname;
  let step = 'landing';
  if (path === '/login') step = 'login';
  else if (path === '/import') step = 'import';
  else if (path === '/questionnaire') step = 'questionnaire';
  else if (path.startsWith('/app')) step = 'app';

  const activeModeMatch = path.match(/^\/app\/([^/]+)/);
  const activeMode = activeModeMatch ? activeModeMatch[1] : 'welcome';

  // Keep modes mounted (hidden) once visited to preserve state
  const [mountedModes, setMountedModes] = useState(() => {
    const match = window.location.pathname.match(/^\/app\/([^/]+)/);
    const init = match ? match[1] : 'welcome';
    return new Set([init, 'welcome']);
  });

  useEffect(() => {
    setMountedModes(prev => {
      if (prev.has(activeMode)) return prev;
      const next = new Set(prev); next.add(activeMode); return next;
    });
  }, [activeMode]);

  const [playerProfile, setPlayerProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [source, setSource] = useState('chess.com');
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [repertoireData, setRepertoireData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // ── Auth session restore ──
  useEffect(() => {
    if (user === undefined) return;

    if (!user || !profile) {
      if (path.startsWith('/app') || path === '/import' || path === '/questionnaire') {
        navigate('/login');
        setUsername('');
        setPlayerProfile(null);
      }
      return;
    }

    if (!profile.chess_username) {
      navigate('/login');
      return;
    }

    const savedUsername = profile.chess_username;
    const savedSource   = profile.chess_source || 'chess.com';
    setUsername(savedUsername);
    setSource(savedSource);

    if (path.startsWith('/app') || path === '/import' || path === '/questionnaire') return;

    const cachedProfile = localStorage.getItem('playerProfile');
    if (cachedProfile) {
      try {
        setPlayerProfile(JSON.parse(cachedProfile));
        navigate('/app/welcome');
      } catch {}
    }

    axios.get(`${API_BASE}/cached-profile`, { params: { username: savedUsername } })
      .then(res => {
        setPlayerProfile(res.data);
        localStorage.setItem('playerProfile', JSON.stringify(res.data));
        if (!path.startsWith('/app')) navigate('/app/welcome');
      })
      .catch(() => {
        if (!path.startsWith('/app')) navigate('/import');
      });
  }, [user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setProgress(p => (p >= 95 ? 95 : p + Math.floor(Math.random() * 3) + 1));
      }, 800);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  /* ── Login success ── */
  const handleLoginSuccess = (chessUsername, chessSource) => {
    setUsername(chessUsername);
    setSource(chessSource || 'chess.com');
    navigate('/import');
  };

  /* ── Refresh data ── */
  const handleRefreshData = async () => {
    if (!username) return;
    setLoading(true);
    setLoadingMessage(`Refreshing games for ${username}…`);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/analyze-profile`, { source, username });
      setPlayerProfile(res.data);
      localStorage.setItem('playerProfile', JSON.stringify(res.data));
    } catch (err) {
      setError(extractError(err, 'Error refreshing games'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Import games ── */
  const handleGameImport = async (importedSource, importedUsername) => {
    setLoading(true);
    setLoadingMessage(`Fetching games for ${importedUsername}… this can take a minute.`);
    setError(null);
    try {
      setUsername(importedUsername);
      setSource(importedSource);
      const res = await axios.post(`${API_BASE}/analyze-profile`, {
        source: importedSource,
        username: importedUsername,
      });
      setPlayerProfile(res.data);
      localStorage.setItem('playerProfile', JSON.stringify(res.data));
      navigate('/app/welcome');
    } catch (err) {
      setError(extractError(err, 'Error importing games'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Profile accepted → questionnaire ── */
  const handleProfileAccepted = async () => {
    setLoading(true);
    setLoadingMessage('Building your personalized questionnaire…');
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/generate-questionnaire`, { source, username });
      setQuestionnaireData(res.data);
      navigate('/questionnaire');
    } catch (err) {
      setError(extractError(err, 'Error generating questionnaire'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Questionnaire submitted ── */
  const handlePreferencesSubmitted = async (questionnaire_response) => {
    setLoading(true);
    setLoadingMessage('Saving your position preferences…');
    setError(null);
    try {
      const preferences = {};
      if (questionnaireData?.position_types_with_stats) {
        questionnaireData.position_types_with_stats.forEach(item => {
          preferences[item.position_type] =
            questionnaire_response.selected_positions.includes(item.position_type) ? 5 : 1;
        });
      }
      const payload = { username: questionnaire_response.username, preferences, color: questionnaire_response.color };
      await axios.post(`${API_BASE}/submit-preferences`, payload);
      setRepertoireData({ preferences, color: payload.color });
      setMountedModes(prev => { const next = new Set(prev); next.add('coach'); return next; });
      navigate('/app/coach');
    } catch (err) {
      setError(extractError(err, 'Error saving preferences'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Mode selection ── */
  const handleModeSelect = (mode) => {
    setMountedModes(prev => { const next = new Set(prev); next.add(mode); return next; });
    navigate(`/app/${mode}`);
  };

  /* ── Sign out ── */
  const handleReset = async () => {
    localStorage.removeItem('playerProfile');
    setPlayerProfile(null);
    setUsername('');
    setQuestionnaireData(null);
    setRepertoireData(null);
    setError(null);
    await signOut(); // auth effect above will navigate to /login
  };

  /* ── Chess username changed in account settings ── */
  const handleChessUsernameChanged = (newUsername, newSource) => {
    setUsername(newUsername);
    setSource(newSource);
    setPlayerProfile(null);
    localStorage.removeItem('playerProfile');
    navigate('/import');
  };

  /* ── Loading overlay ── */
  const loadingOverlay = loading && (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="spinner" />
        <h3>{loadingMessage || 'Loading…'}</h3>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="progress-text">{progress}%</p>
      </div>
    </div>
  );

  /* ── Auth still loading ── */
  if (user === undefined) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="app">
      {loadingOverlay}

      {error && step !== 'app' && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 400, width: '90%' }}>
          <div className="error-message">{error}</div>
        </div>
      )}

      {step === 'landing' && (
        <LandingPage onStart={() => navigate('/login')} />
      )}

      {step === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {step === 'import' && (
        <div className="app-page-wrap">
          <div className="app-page-header">
            <div className="app-page-logo" onClick={() => navigate('/login')}>
              <Logo size={30} />
              <span>MyChess<strong>2nd</strong></span>
            </div>
          </div>
          <GameImporter
            onImport={handleGameImport}
            disabled={loading}
            defaultUsername={username || ''}
          />
        </div>
      )}

      {step === 'questionnaire' && questionnaireData && (
        <div className="app-page-wrap">
          <div className="app-page-header">
            <div className="app-page-logo" onClick={() => navigate('/login')}>
              <Logo size={30} />
              <span>MyChess<strong>2nd</strong></span>
            </div>
          </div>
          {error && <div className="error-message" style={{ margin: '0 auto', maxWidth: 600 }}>{error}</div>}
          <Questionnaire
            questions={questionnaireData.questions}
            positionTypes={questionnaireData.position_types}
            positionTypesWithStats={questionnaireData.position_types_with_stats}
            username={username}
            onSubmit={handlePreferencesSubmitted}
            disabled={loading}
          />
        </div>
      )}

      {step === 'app' && (
        <AppLayout
          activeMode={activeMode}
          onSelect={handleModeSelect}
          username={username}
          onLogout={handleReset}
          onChessUsernameChanged={handleChessUsernameChanged}
        >
          {mountedModes.has('welcome') && (
            <div style={{ display: activeMode === 'welcome' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <WelcomePage username={username} profile={playerProfile} onSelect={handleModeSelect} onRefresh={handleRefreshData} />
            </div>
          )}
          {mountedModes.has('coach') && (
            <div style={{ display: activeMode === 'coach' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <OpeningCoach username={username} source={source} playerProfile={playerProfile} isActive={activeMode === 'coach'} />
            </div>
          )}
          {mountedModes.has('explorer') && (
            <div style={{ display: activeMode === 'explorer' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <ChessExplorer />
            </div>
          )}
          {mountedModes.has('stockfish') && (
            <div style={{ display: activeMode === 'stockfish' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <EngineTraining username={username} />
            </div>
          )}
          {mountedModes.has('position') && (
            <div style={{ display: activeMode === 'position' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <CustomPosition />
            </div>
          )}
          {mountedModes.has('opponent') && (
            <div style={{ display: activeMode === 'opponent' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <TrainVsPlayer username={username} source={source} />
            </div>
          )}
          {mountedModes.has('playvs') && (
            <div style={{ display: activeMode === 'playvs' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
              <PlayVsStockfish />
            </div>
          )}
        </AppLayout>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
