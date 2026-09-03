import { useState } from 'react';

// sessionStorage clears automatically when the tab/browser is closed —
// that's the "remembered while on the site, gone after" behavior we want.
// (localStorage would persist forever instead, which is NOT what we want here.)

function NamePrompt({ onNameSet }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleContinue() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name to continue');
      return;
    }
    sessionStorage.setItem('mafia_playerName', trimmed);
    onNameSet(trimmed);
  }

  return (
    <div className="page-bg login-screen">
      <div className="login-card glass-panel">
        <h1 className="login-title">Mafia</h1>
        <p className="login-subtitle">Enter a name to play</p>

        <input
          className="login-input"
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
          autoFocus
        />

        <button className="btn-primary" onClick={handleContinue}>
          Continue
        </button>

        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}

export default NamePrompt;
