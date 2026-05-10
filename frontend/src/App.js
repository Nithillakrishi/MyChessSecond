import React, { useState } from 'react';
import GameImporter from './components/GameImporter';
import PlayerProfile from './components/PlayerProfile';
import OpeningSelector from './components/OpeningSelector';
import PositionComparison from './components/PositionComparison';
import Questionnaire from './components/Questionnaire';
import InteractiveCoach from './components/InteractiveCoach';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [currentStep, setCurrentStep] = useState('import'); // import, profile, questionnaire, repertoire
  const [playerProfile, setPlayerProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [questionnaireData, setQuestionnaireData] = useState(null);
  const [repertoireData, setRepertoireData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Fake progress bar for long loading states
  React.useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return 95; // Stall at 95% until complete
          return prev + Math.floor(Math.random() * 3) + 1; // Randomly add 1-3%
        });
      }, 800);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGameImport = async (source, importedUsername) => {
    setLoading(true);
    setLoadingMessage(`Fetching and analyzing games for ${importedUsername}... This can take a minute for large accounts (5,000+ games).`);
    setError(null);
    try {
      setUsername(importedUsername);
      // Analyze player profile
      const response = await axios.post(`${API_BASE}/analyze-profile`, {
        source,
        username: importedUsername
      });
      setPlayerProfile(response.data);
      setCurrentStep('profile');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error importing games');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoMode = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load sample data for demo
      const response = await axios.post(`${API_BASE}/test-sample`);
      setPlayerProfile(response.data.player_profile);
      setCurrentStep('profile');
    } catch (err) {
      setError('Error loading demo data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileAccepted = async () => {
    setLoading(true);
    setLoadingMessage('Generating questionnaire based on your games...');
    setError(null);
    try {
      const response = await axios.post(`${API_BASE}/generate-questionnaire`, {
        source: 'chess.com', // Assuming source doesn't strictly matter here anymore
        username: username
      });
      setQuestionnaireData(response.data);
      setCurrentStep('questionnaire');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error generating questionnaire');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSubmitted = async (preferences) => {
    setLoadingMessage('Calculating optimal opening repertoire for your style...');
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/submit-preferences`, preferences);
      
      setRepertoireData({
         preferences: preferences.preferences,
         color: preferences.color
      });
      setCurrentStep('repertoire');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error saving preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep('import');
    setPlayerProfile(null);
    setUsername('');
    setQuestionnaireData(null);
    setRepertoireData(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟ Chess <span>Second</span></h1>
        <p>Opening Coach</p>
      </header>

      <main className="app-main">
        {error && <div className="error-message">{error}</div>}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="spinner"></div>
              <h3>{loadingMessage || 'Loading...'}</h3>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="progress-text">{progress}%</p>
            </div>
          </div>
        )}

        {currentStep === 'import' && (
          <GameImporter onImport={handleGameImport} onDemo={handleDemoMode} disabled={loading} />
        )}

        {currentStep === 'profile' && playerProfile && (
          <PlayerProfile
            profile={playerProfile}
            onContinue={handleProfileAccepted}
            onReset={handleReset}
          />
        )}

        {currentStep === 'questionnaire' && questionnaireData && (
          <Questionnaire 
            questions={questionnaireData.questions}
            username={username}
            onSubmit={handlePreferencesSubmitted}
            disabled={loading}
          />
        )}

        {currentStep === 'repertoire' && repertoireData && (
          <InteractiveCoach 
            username={username}
            preferences={repertoireData.preferences}
            color={repertoireData.color}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Chess Second © 2026 | Powered by Stockfish & Chess.com/Lichess APIs</p>
      </footer>
    </div>
  );
}

export default App;
