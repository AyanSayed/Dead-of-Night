import { useState, useEffect } from 'react';
import { socket } from '../socket';

function Lobby({ playerName, onRoomJoined }) {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    socket.on('join_error', (msg) => {
      setError(msg);
    });

    return () => {
      socket.off('join_error');
    };
  }, []);

  function handleCreateRoom() {
    setError('');
    socket.emit('create_room', { hostName: playerName });
  }

  function handleJoinRoom() {
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setError('');
    socket.emit('join_room', { code: joinCode.toUpperCase(), name: playerName });
  }

  return (
    <div className="page-bg dashboard-screen">
      <div className="dashboard-card glass-panel">
        <h1 className="dashboard-title">Mafia</h1>
        <p className="dashboard-greeting">
          Playing as <strong>{playerName}</strong>
        </p>

        <div className="dashboard-actions">
          <button className="btn-primary" onClick={handleCreateRoom}>
            Create Game
          </button>

          <div className="join-row">
            <input
              className="login-input"
              type="text"
              placeholder="Room code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <button className="btn-secondary" onClick={handleJoinRoom} style={{ width: 'auto', whiteSpace: 'nowrap' }}>
              Join Game
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}

export default Lobby;