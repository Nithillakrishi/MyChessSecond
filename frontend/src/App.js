import React, { useState, useEffect } from 'react';
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

const API_BASE = 'http://localhost:8000';

function extractError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join('; ');
  return JSON.stringify(detail);
}

function AppInner() {
  const { user, profile, signOut } = useAuth();

  // Steps: landing | login | import | questionnaire | app
  const [step, setStep] = useState('landing');
  const [activeMode, setActiveMode] = useState('welcome');
  const [mountedModes, setMountedModes] = useState(() => new Set(['welcome']));

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
  // Fires when Supabase resolves the session (including on page refresh from another device)
  useEffect(() => {
    if (user === undefined) return; // still loading auth state

    if (!user || !profile) {
      // Signed out — reset to start
      if (step === 'app' || step === 'import' || step === 'questionnaire') {
        setStep('login');
        setUsername('');
        setPlayerProfile(null);
      }
      return;
    }

    if (!profile.chess_username) {
      // Signed in with Google but hasn't set chess username yet → LoginPage handles step 2
      setStep('login');
      return;
    }

    // Signed in with chess username set — restore session
    const savedUsername  = profile.chess_username;
    const savedSource    = profile.chess_source || 'chess.com';
    setUsername(savedUsername);
    setSource(savedSource);

    // Avoid overriding a step the user is already in (e.g., questionnaire)
    if (step === 'app' || step === 'import' || step === 'questionnaire') return;

    // Fast restore from localStorage cache
    const cachedProfile = localStorage.getItem('playerProfile');
    if (cachedProfile) {
      try {
        setPlayerProfile(JSON.parse(cachedProfile));
        setStep('app');
      } catch {}
    }

    // Refresh from backend in background
    axios.get(`${API_BASE}/cached-profile`, { params: { username: savedUsername } })
      .then(res => {
        setPlayerProfile(res.data);
        localStorage.setItem('playerProfile', JSON.stringify(res.data));
        setStep('app');
      })
      .catch(() => {
        // No backend cache → go to import so user can fetch their games
        if (step !== 'app') setStep('import');
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

  /* ── Login success — called by LoginPage after chess username is set ── */
  const handleLoginSuccess = (chessUsername, chessSource) => {
    setUsername(chessUsername);
    setSource(chessSource || 'chess.com');
    setStep('import');
  };

  /* ── Refresh data handler ── */
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

  /* ── Import handler ── */
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
      setStep('app');
    } catch (err) {
      setError(extractError(err, 'Error importing games'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Profile accepted → generate questionnaire ── */
  const handleProfileAccepted = async () => {
    setLoading(true);
    setLoadingMessage('Building your personalized questionnaire…');
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/generate-questionnaire`, { source, username });
      setQuestionnaireData(res.data);
      setStep('questionnaire');
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
      setActiveMode('coach');
      setStep('app');
    } catch (err) {
      setError(extractError(err, 'Error saving preferences'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Mode selection ── */
  const handleModeSelect = (mode) => {
    setActiveMode(mode);
    setMountedModes(prev => { const next = new Set(prev); next.add(mode); return next; });
  };

  /* ── Sign out ── */
  const handleReset = async () => {
    localStorage.removeItem('playerProfile');
    setPlayerProfile(null);
    setUsername('');
    setQuestionnaireData(null);
    setRepertoireData(null);
    setError(null);
    setActiveMode('welcome');
    await signOut(); // Supabase clears session → auth effect above sets step to 'login'
  };

  /* ── Called from AccountSettings when chess username changes ── */
  const handleChessUsernameChanged = (newUsername, newSource) => {
    setUsername(newUsername);
    setSource(newSource);
    setPlayerProfile(null);
    localStorage.removeItem('playerProfile');
    setStep('import');
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

  /* ── Auth still loading — show blank ── */
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
        <LandingPage onStart={() => setStep('login')} />
      )}

      {step === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {step === 'import' && (
        <div className="app-page-wrap">
          <div className="app-page-header">
            <div className="app-page-logo" onClick={() => setStep('login')}>
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
            <div className="app-page-logo" onClick={() => setStep('login')}>
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
              <OpeningCoach username={username} playerProfile={playerProfile} isActive={activeMode === 'coach'} />
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
