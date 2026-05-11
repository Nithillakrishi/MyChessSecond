import React, { useState, useEffect } from 'react';
import GameImporter from './components/GameImporter';
import Questionnaire from './components/Questionnaire';
import InteractiveCoach from './components/InteractiveCoach';
import LandingPage, { Logo } from './components/LandingPage';
import LoginPage from './components/LoginPage';
import AppLayout from './components/AppLayout';
import WelcomePage from './components/WelcomePage';
import PlayVsStockfish from './components/PlayVsStockfish';
import CustomPosition from './components/CustomPosition';
import ChessExplorer from './components/ChessExplorer';
import EngineTraining from './components/EngineTraining';
import TrainVsPlayer from './components/TrainVsPlayer';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  // Top-level step: login | landing | import | profile | questionnaire | app
  const [step, setStep] = useState('login');
  // Active mode inside the app layout
  const [activeMode, setActiveMode] = useState('welcome');

  const [loggedInUser, setLoggedInUser] = useState(null);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [source, setSource] = useState('chess.com');
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [repertoireData, setRepertoireData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setLoggedInUser(savedUsername);
      setStep('landing');
    }
  }, []);

  React.useEffect(() => {
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

  /* ── Login handler ── */
  const handleLoginSuccess = (username) => {
    setLoggedInUser(username);
    setStep('landing');
  };

  /* ── Refresh data handler ── */
  const handleRefreshData = async () => {
    if (!loggedInUser || !username) return;
    
    setLoading(true);
    setLoadingMessage(`Refreshing games for ${username}…`);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/analyze-profile`, {
        source: source,
        username: username,
      });
      setPlayerProfile(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error refreshing games');
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
      setStep('app');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error importing games');
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
      setError(err.response?.data?.detail || 'Error generating questionnaire');
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
      // Convert selected_positions array to preferences dict
      // Selected positions get score of 5, unselected get 1
      const preferences = {};
      if (questionnaireData && questionnaireData.position_types_with_stats) {
        questionnaireData.position_types_with_stats.forEach(item => {
          preferences[item.position_type] = 
            questionnaire_response.selected_positions.includes(item.position_type) ? 5 : 1;
        });
      }
      
      // Send in backend-expected format
      const payload = {
        username: questionnaire_response.username,
        preferences: preferences,
        color: questionnaire_response.color
      };
      
      await axios.post(`${API_BASE}/submit-preferences`, payload);
      setRepertoireData({ preferences, color: payload.color });
      setActiveMode('coach');
      setStep('app');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error saving preferences');
    } finally {
      setLoading(false);
    }
  };

  /* ── Mode selection from WelcomePage or sidebar ── */
  const handleModeSelect = (mode) => {
    if (mode === 'coach' && !repertoireData) {
      // Need questionnaire first
      handleProfileAccepted();
      return;
    }
    setActiveMode(mode);
  };

  /* ── Reset ── */
  const handleReset = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    setLoggedInUser(null);
    setStep('login');
    setActiveMode('welcome');
    setPlayerProfile(null);
    setUsername('');
    setQuestionnaireData(null);
    setRepertoireData(null);
    setError(null);
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

  /* ── Render ── */
  return (
    <div className="app">
      {loadingOverlay}

      {error && step !== 'app' && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 400, width: '90%' }}>
          <div className="error-message">{error}</div>
        </div>
      )}

      {step === 'login' && (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}

      {step === 'landing' && (
        <LandingPage onStart={() => setStep('import')} />
      )}

      {step === 'import' && (
        <div className="app-page-wrap">
          <div className="app-page-header">
            <div className="app-page-logo" onClick={handleReset}>
              <Logo size={30} />
              <span>MyChess<strong>2nd</strong></span>
            </div>
          </div>
          <GameImporter onImport={handleGameImport} disabled={loading} />
        </div>
      )}

      {step === 'questionnaire' && questionnaireData && (
        <div className="app-page-wrap">
          <div className="app-page-header">
            <div className="app-page-logo" onClick={handleReset}>
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
        >
          {activeMode === 'welcome' && (
            <WelcomePage
              username={username}
              profile={playerProfile}
              onSelect={handleModeSelect}
              questionnaireData={questionnaireData}
              onRefresh={handleRefreshData}
            />
          )}

          {activeMode === 'coach' && repertoireData && (
            <InteractiveCoach
              username={username}
              preferences={repertoireData.preferences}
              color={repertoireData.color}
              onReset={() => setActiveMode('welcome')}
            />
          )}

          {activeMode === 'explorer' && <ChessExplorer />}

          {activeMode === 'stockfish' && <EngineTraining />}

          {activeMode === 'position' && <CustomPosition />}

          {activeMode === 'opponent' && (
            <TrainVsPlayer username={username} source={source} />
          )}

          {activeMode === 'playvs' && (
            <PlayVsStockfish />
          )}
        </AppLayout>
      )}

    </div>
  );
}

export default App;
