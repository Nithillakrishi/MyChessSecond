import React, { useState } from 'react';
import GameImporter from './components/GameImporter';
import PlayerProfile from './components/PlayerProfile';
import OpeningSelector from './components/OpeningSelector';
import PositionComparison from './components/PositionComparison';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [currentStep, setCurrentStep] = useState('import'); // import, profile, opening, comparison
  const [playerProfile, setPlayerProfile] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedFirstMoves, setSelectedFirstMoves] = useState([]);
  const [positions, setPositions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGameImport = async (source, username) => {
    setLoading(true);
    setError(null);
    try {
      // Analyze player profile
      const response = await axios.post(`${API_BASE}/analyze-profile`, {
        source,
        username
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

  const handleProfileAccepted = () => {
    setCurrentStep('opening');
  };

  const handleOpeningSelected = async (color, firstMoves) => {
    setLoading(true);
    setError(null);
    try {
      setSelectedColor(color);
      setSelectedFirstMoves(firstMoves);

      // Get opening positions
      const response = await axios.post(`${API_BASE}/get-opening-positions`, {
        color,
        first_moves: firstMoves
      });
      setPositions(response.data);
      setCurrentStep('comparison');
    } catch (err) {
      setError(err.response?.data?.detail || 'Error fetching positions');
    } finally {
      setLoading(false);
    }
  };

  const handlePositionSelected = (positionData) => {
    // Handle position selection - could save to user profile or start game
    console.log('Position selected:', positionData);
    alert('Position selected! Ready to play from this position.');
  };

  const handleReset = () => {
    setCurrentStep('import');
    setPlayerProfile(null);
    setSelectedColor(null);
    setSelectedFirstMoves([]);
    setPositions(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟ Chess Second</h1>
        <p>Your Opening Coach</p>
      </header>

      <main className="app-main">
        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading">Loading...</div>}

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

        {currentStep === 'opening' && (
          <OpeningSelector
            profile={playerProfile}
            onSelect={handleOpeningSelected}
            disabled={loading}
          />
        )}

        {currentStep === 'comparison' && positions && (
          <PositionComparison
            positions={positions}
            onSelect={handlePositionSelected}
            onBack={() => setCurrentStep('opening')}
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
