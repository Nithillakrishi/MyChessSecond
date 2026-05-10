import React, { useState } from 'react';
import GameImporter from './components/GameImporter';
import PlayerProfile from './components/PlayerProfile';
import Questionnaire from './components/Questionnaire';
import InteractiveCoach from './components/InteractiveCoach';
import LandingPage, { Logo } from './components/LandingPage';
import AppLayout from './components/AppLayout';
import WelcomePage from './components/WelcomePage';
import PlayVsStockfish from './components/PlayVsStockfish';
import CustomPosition from './components/CustomPosition';
import TrainVsPlayer from './components/TrainVsPlayer';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  // Top-level step: landing | import | profile | questionnaire | app
  const [step, setStep] = useState('landing');
  // Active mode inside the app layout
  const [activeMode, setActiveMode] = useState('welcome');

  const [playerProfile, setPlayerProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [source, setSource] = useState('chess.com');
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [repertoireData, setRepertoireData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

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
      setStep('profile');
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
  const handlePreferencesSubmitted = async (preferences) => {
    setLoading(true);
    setLoadingMessage('Saving your style preferences…');
    setError(null);
    try {
      await axios.post(`${API_BASE}/submit-preferences`, preferences);
      setRepertoireData({ preferences: preferences.preferences, color: preferences.color });
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
    setStep('landing');
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

      {step === 'profile' && playerProfile && (
        <div className="app-page-wrap">
          <div className="app-page-header">
            <div className="app-page-logo" onClick={handleReset}>
              <Logo size={30} />
              <span>MyChess<strong>2nd</strong></span>
            </div>
          </div>
          {error && <div className="error-message" style={{ margin: '0 auto', maxWidth: 600 }}>{error}</div>}
          <PlayerProfile profile={playerProfile} onContinue={handleProfileAccepted} onReset={handleReset} />
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

          {(activeMode === 'explorer' || activeMode === 'stockfish' || activeMode === 'position') && (
            <CustomPosition />
          )}

          {activeMode === 'opponent' && (
            <TrainVsPlayer />
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
