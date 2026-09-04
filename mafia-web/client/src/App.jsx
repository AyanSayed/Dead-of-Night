import { useState, useEffect } from 'react';
import NamePrompt from './pages/NamePrompt';
import Rules from './pages/Rules';
import Roles from './pages/Roles';
import Lobby from './components/Lobby';
import Sidebar from './components/Sidebar';
import GameRoom from './pages/GameRoom';
import { socket } from './socket';

function App() {
  const [playerName, setPlayerName] = useState(
    () => sessionStorage.getItem('mafia_playerName') || ''
  );
  const [view, setView] = useState('dashboard');
  const [room, setRoom] = useState(null);
  const [myId, setMyId] = useState(socket.id);

  useEffect(() => {
    function handleConnect() {
      setMyId(socket.id);
    }
    function handleRoomUpdate(roomState) {
      setRoom(roomState);
    }

    socket.on('connect', handleConnect);
    socket.on('room_created', handleRoomUpdate);
    socket.on('room_update', handleRoomUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room_created', handleRoomUpdate);
      socket.off('room_update', handleRoomUpdate);
    };
  }, []);

  if (!playerName) {
    return <NamePrompt onNameSet={setPlayerName} />;
  }

  const goDashboard = () => setView('dashboard');
  const goRules = () => setView('rules');
  const goRoles = () => setView('roles');

  function handleStartGame() {
    socket.emit('start_game', { code: room.code });
  }

  function renderScreen() {
    if (room) {
      return (
        <GameRoom
          room={room}
          myId={myId}
          playerName={playerName}
          onStartGame={handleStartGame}
        />
      );
    }

    if (view === 'rules') {
      return <Rules onBack={goDashboard} onShowRoles={goRoles} />;
    }

    if (view === 'roles') {
      return <Roles onBack={goDashboard} />;
    }

    return <Lobby playerName={playerName} onRoomJoined={setRoom} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={room ? null : view}
        onShowDashboard={goDashboard}
        onShowRules={goRules}
        onShowRoles={goRoles}
      />
      {renderScreen()}
    </div>
  );
}

export default App;