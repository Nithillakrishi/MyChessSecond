import React, { useState } from 'react';
import './Questionnaire.css';

function Questionnaire({ questions, onSubmit, disabled, username }) {
  const [answers, setAnswers] = useState({});
  const [desiredMoves, setDesiredMoves] = useState('');
  const [color, setColor] = useState('white');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const handleSelect = (questionId, selectedPosType, score) => {
    setAnswers(prev => ({
      ...prev,
      [selectedPosType]: (prev[selectedPosType] || 0) + score
    }));
    
    // Proceed to the next question or finish screen
    setCurrentQuestionIndex(curr => curr + 1);
  };

  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFinished = currentQuestionIndex >= questions.length;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Pass preferred color and preferences forwards (interactive coach handles moves)
    onSubmit({
      username: username,
      preferences: answers,
      color: color
    });
  };

  if (isFinished) {
    return (
      <div className="questionnaire-card final-step">
        <h2>Your Preferences are Set!</h2>
        <p>You're ready to start interactive coaching.</p>
        
        <form onSubmit={handleSubmit} className="preferences-form">
          <div className="form-group">
            <label>Color you want to play:</label>
            <select value={color} onChange={e => setColor(e.target.value)} disabled={disabled}>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
          </div>
          
          <button type="submit" className="submit-btn" disabled={disabled}>
            Enter Interactive Coach
          </button>
        </form>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="questionnaire-card">
      <div className="progress">
        Question {currentQuestionIndex + 1} of {questions.length}
      </div>
      <h2>Which position type do you prefer?</h2>
      
      <div className="options-container">
        <div 
          className="option-card"
          onClick={() => handleSelect(currentQ.question_id, currentQ.position_type_1, 5)}
        >
          <h3>Option A: {currentQ.position_type_1}</h3>
          <p>{currentQ.description_1}</p>
          <div className="stat">Your Win Rate: {currentQ.your_win_rate_1}</div>
        </div>
        
        <div className="option-divider">OR</div>
        
        <div 
          className="option-card"
          onClick={() => handleSelect(currentQ.question_id, currentQ.position_type_2, 5)}
        >
          <h3>Option B: {currentQ.position_type_2}</h3>
          <p>{currentQ.description_2}</p>
          <div className="stat">Your Win Rate: {currentQ.your_win_rate_2}</div>
        </div>
      </div>
    </div>
  );
}

export default Questionnaire;