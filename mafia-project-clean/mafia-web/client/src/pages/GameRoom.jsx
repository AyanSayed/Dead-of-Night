import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

const HOST_ID = 'host';

// One static image per phase/role — filenames it expects in client/public/images/.
// Edit the paths if you name your files differently.
const IMAGE_MAP = {
  night: '/images/night.jpg',
  day: '/images/day.jpg',
  voting: '/images/voting.jpg',
  rip: '/images/confirm-vote.jpg',
  mafia: '/images/mafia.jpg',
  doctor: '/images/doctor.jpg',
  detective: '/images/detective.jpg',
  villager: '/images/villager.jpg',
};

const ROLE_INFO = {
  mafia: {
    title: 'Mafia',
    desc: "Work with your fellow Mafia to eliminate the town without getting caught. Each night, choose a player to eliminate.",
  },
  doctor: {
    title: 'Doctor',
    desc: "Protect one player each night from the Mafia's kill. You may protect yourself.",
  },
  detective: {
    title: 'Detective',
    desc: "Investigate one player each night to learn whether they are Mafia.",
  },
  villager: {
    title: 'Villager',
    desc: "You have no night action. Use the day to discuss and vote out anyone you suspect is Mafia.",
  },
};
// Team alignment per role — drives the red/green/grey coloring.
// mafia = red, town side (villager/doctor/detective) = green, anything
// unmatched = grey (reserved for future neutral roles).
const ROLE_ALIGNMENT = {
  mafia: 'mafia',
  doctor: 'town',
  detective: 'town',
  villager: 'town',
};

function getAlignmentClass(role) {
  const alignment = ROLE_ALIGNMENT[role] || 'neutral';
  return `align-${alignment}`; // align-mafia | align-town | align-neutral
}

function GameRoom({ room, myId, playerName, onStartGame }) {
  const [publicLog, setPublicLog] = useState(room.publicLog || []);
  const [activeThread, setActiveThread] = useState(null);
  const [threads, setThreads] = useState({});
  const [draft, setDraft] = useState('');
  const [nightActed, setNightActed] = useState(false);
  const [voted, setVoted] = useState(false);
  const [nightTargetId, setNightTargetId] = useState(null);
  const [voteTargetId, setVoteTargetId] = useState(null);
  const [confirmVoted, setConfirmVoted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [highlightId, setHighlightId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState(new Set());
  const scrollRef = useRef(null);
  const activeThreadRef = useRef(activeThread);

  const isHost = myId === room.hostId;
  const me = room.players.find(p => p.id === myId);
  const myRole = room.myRole;

  useEffect(() => { activeThreadRef.current = activeThread; }, [activeThread]);

  function triggerHighlight(id) {
    setHighlightId(id);
    setTimeout(() => {
      setHighlightId((current) => (current === id ? null : current));
    }, 2000);
  }

  useEffect(() => {
    socket.on('public_message', (msg) => {
      setPublicLog((prev) => [...prev, msg]);
      triggerHighlight(msg.id);
    });
    socket.on('dm_message', (msg) => {
      const otherId = msg.from === myId ? msg.to : msg.from;
      setThreads((prev) => ({ ...prev, [otherId]: [...(prev[otherId] || []), msg] }));
      if (msg.from === HOST_ID) setActiveThread(HOST_ID);
      if (otherId !== activeThreadRef.current) {
        setUnreadCounts((prev) => ({ ...prev, [otherId]: (prev[otherId] || 0) + 1 }));
      }
      triggerHighlight(msg.id);
    });
    socket.on('dm_thread', ({ otherId, thread }) => {
      setThreads((prev) => ({ ...prev, [otherId]: thread }));
    });
    socket.on('group_message', (msg) => {
      const key = `group:${msg.groupId}`;
      setThreads((prev) => ({ ...prev, [key]: [...(prev[key] || []), msg] }));
      if (key !== activeThreadRef.current) {
        setUnreadCounts((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
      triggerHighlight(msg.id);
    });
    socket.on('group_thread', ({ groupId, thread }) => {
      setThreads((prev) => ({ ...prev, [`group:${groupId}`]: thread }));
    });
    socket.on('night_action_confirmed', () => setNightActed(true));
    socket.on('vote_confirmed', () => setVoted(true));
    socket.on('confirm_vote_confirmed', () => setConfirmVoted(true));

    return () => {
      socket.off('public_message');
      socket.off('dm_message');
      socket.off('dm_thread');
      socket.off('group_message');
      socket.off('group_thread');
      socket.off('night_action_confirmed');
      socket.off('vote_confirmed');
      socket.off('confirm_vote_confirmed');
    };
  }, [myId]);

  useEffect(() => {
    setPublicLog(room.publicLog || []);
    setNightActed(false);
    setVoted(false);
    setNightTargetId(null);
    setVoteTargetId(null);
    setConfirmVoted(false);
  }, [room.phase, room.round]);

  useEffect(() => {
    if (room.phase === 'waiting' || room.phase === 'starting') return;
    socket.emit('get_dm_thread', { code: room.code, otherId: HOST_ID });
    if (activeThreadRef.current !== HOST_ID) {
      setUnreadCounts((prev) => ({ ...prev, [HOST_ID]: (prev[HOST_ID] || 0) + 1 }));
    }
  }, [room.phase, room.round, room.code]);

  useEffect(() => {
    if (!room.phaseEndsAt) { setSecondsLeft(null); return; }
    function tick() {
      const remaining = Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [room.phaseEndsAt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [publicLog, threads, activeThread]);

  function openThread(otherId) {
    setActiveThread(otherId);
    setUnreadCounts((prev) => ({ ...prev, [otherId]: 0 }));
    if (typeof otherId === 'string' && otherId.startsWith('group:')) {
      socket.emit('get_group_thread', { code: room.code, groupId: otherId.slice(6) });
    } else {
      socket.emit('get_dm_thread', { code: room.code, otherId });
    }
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (activeThread === null) {
      socket.emit('send_public_message', { code: room.code, text });
    } else if (typeof activeThread === 'string' && activeThread.startsWith('group:')) {
      socket.emit('send_group_message', { code: room.code, groupId: activeThread.slice(6), text });
    } else {
      socket.emit('send_dm', { code: room.code, toId: activeThread, text });
    }
  }

  function toggleGroupMember(id) {
    setGroupMembers((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleCreateGroup() {
    if (!groupName.trim() || groupMembers.size === 0) return;
    socket.emit('create_group', { code: room.code, name: groupName.trim(), memberIds: [...groupMembers] });
    setShowGroupModal(false);
    setGroupName('');
    setGroupMembers(new Set());
  }

  function handleNightTarget(targetId) {
    setNightTargetId(targetId);
    socket.emit('submit_night_action', { code: room.code, targetId });
  }

  function handleVote(targetId) {
    setVoteTargetId(targetId);
    socket.emit('submit_vote', { code: room.code, targetId });
  }

  function handleConfirmVote(choice) {
    socket.emit('submit_confirm_vote', { code: room.code, choice });
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatCount(n) {
    if (!n) return null;
    return n > 4 ? '4+' : String(n);
  }

  if (room.phase === 'waiting') {
    return (
      <div className="page-bg dashboard-screen">
        <div className="dashboard-card glass-panel">
          <div className="room-code-row">
            <h2>Room: {room.code}</h2>
            <button className="btn-secondary copy-btn" onClick={handleCopyCode}>
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
          </div>
          <p>Waiting for players to start...</p>
          <ul style={{ textAlign: 'left', width: '100%' }}>
            {room.players.map((p) => (
              <li key={p.id}>{p.name} {p.isBot ? '(bot)' : ''}</li>
            ))}
          </ul>
          {isHost && (
            <>
              <button className="btn-secondary" onClick={() => socket.emit('add_bot', { code: room.code })}>
                Add Bot
              </button>
              <button className="btn-primary" onClick={onStartGame} disabled={room.players.length < 3}>
                Start Game
              </button>
            </>
          )}
          {isHost && room.players.length < 3 && <p className="error-text">Need at least 3 players</p>}
        </div>
      </div>
    );
  }

  if (room.phase === 'starting' && room.status === 'waiting') {
    return (
      <div className="page-bg dashboard-screen">
        <div className="dashboard-card glass-panel">
          <h2>Room: {room.code}</h2>
          <p>Get ready — Night 1 begins in {secondsLeft ?? '...'}s...</p>
          <ul style={{ textAlign: 'left', width: '100%' }}>
            {room.players.map((p) => (
              <li key={p.id}>{p.name} {p.isBot ? '(bot)' : ''}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const messages = activeThread === null ? publicLog : (threads[activeThread] || []);
  const alivePlayers = room.players.filter(p => p.alive);
  const otherAlivePlayers = alivePlayers.filter(p => p.id !== myId);
  const amAlive = me ? me.alive : false;
  const hasNightAction = ['mafia', 'doctor', 'detective'].includes(myRole);
  const roleInfo = ROLE_INFO[myRole];
  const alignmentClass = getAlignmentClass(myRole);
  const teammateIds = new Set((room.teammates || []).map(t => t.id));
  const nightTargets = myRole === 'doctor'
    ? alivePlayers
    : myRole === 'mafia'
      ? otherAlivePlayers.filter(p => !teammateIds.has(p.id))
      : otherAlivePlayers;
  const nightTargetName = room.players.find(p => p.id === nightTargetId)?.name;
  const voteTargetName = room.players.find(p => p.id === voteTargetId)?.name;

  const phaseLabel =
    room.phase === 'starting' ? 'Game starts in a moment...' :
    room.phase === 'ended' ? `Game over — ${room.winner === 'mafia' ? 'Mafia' : 'Town'} wins!` :
    room.phase === 'night-announce' ? `🌙 Night is falling...` :
    room.phase === 'night' ? `🌙 Night ${room.round}` :
    room.phase === 'day-announce' ? '☀️ Sunrise report...' :
    room.phase === 'day' ? `☀️ Day ${room.round} — Discussion` :
    room.phase === 'voting' ? `🗳️ Day ${room.round} — Voting` : '';

  const viewingHost = activeThread === HOST_ID;
  const viewingTownSquare = activeThread === null;
  const canSendMessage = amAlive && (!viewingTownSquare || ['day', 'voting', 'confirm-vote'].includes(room.phase));

  return (
    <div className="page-bg dashboard-screen game-screen">
      <div className="glass-panel game-panel">
        <div className="game-sidebar">
          <div className="role-banner">
            {myRole ? <>You are: <strong>{myRole}</strong></> : 'Assigning roles...'}
            {!amAlive && <div className="dead-tag">💀 Eliminated</div>}
          </div>
          <div className="phase-banner">
            {phaseLabel}
            {secondsLeft !== null && room.phase !== 'ended' && (
              <div className="countdown">⏱ {secondsLeft}s</div>
            )}
          </div>

          <div className="sidebar-section-label">Channel</div>
          <div
            className={`chat-contact channel-contact ${activeThread === null ? 'is-active' : ''}`}
            onClick={() => setActiveThread(null)}
          >
            🏛 Town Square
          </div>

          <div className="sidebar-section-label">Direct Messages</div>
          <div className="dm-list">
            <div className={`chat-contact ${activeThread === HOST_ID ? 'is-active' : ''}`} onClick={() => openThread(HOST_ID)}>
              <span>🎭 Host</span>
              {formatCount(unreadCounts[HOST_ID]) && <span className="unread-badge">{formatCount(unreadCounts[HOST_ID])}</span>}
            </div>
            {room.players.filter(p => p.id !== myId).map((p) => (
              <div
                key={p.id}
                className={`chat-contact ${activeThread === p.id ? 'is-active' : ''} ${!p.alive ? 'is-dead' : ''}`}
                onClick={() => openThread(p.id)}
              >
                <span>{p.name} {p.isBot ? '(bot)' : ''} {!p.alive ? '💀' : ''}</span>
                {formatCount(unreadCounts[p.id]) && <span className="unread-badge">{formatCount(unreadCounts[p.id])}</span>}
              </div>
            ))}
          </div>

          <div className="sidebar-section-label">
            Groups
            <button className="btn-secondary group-new-btn" onClick={() => setShowGroupModal(true)}>+ New</button>
          </div>
          <div className="dm-list">
            {(room.groups || []).map((g) => (
              <div
                key={g.id}
                className={`chat-contact ${activeThread === `group:${g.id}` ? 'is-active' : ''}`}
                onClick={() => openThread(`group:${g.id}`)}
              >
                <span>👥 {g.name}</span>
                {formatCount(unreadCounts[`group:${g.id}`]) && <span className="unread-badge">{formatCount(unreadCounts[`group:${g.id}`])}</span>}
              </div>
            ))}
          </div>

          {showGroupModal && (
            <div className="group-modal-backdrop" onClick={() => setShowGroupModal(false)}>
              <div className="group-modal glass-panel" onClick={(e) => e.stopPropagation()}>
                <h3>New Group</h3>
                <input
                  className="login-input"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <div className="group-member-list">
                  {room.players.filter(p => p.id !== myId && !p.isBot).map((p) => (
                    <label key={p.id} className="group-member-row">
                      <input
                        type="checkbox"
                        checked={groupMembers.has(p.id)}
                        onChange={() => toggleGroupMember(p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
                <button className="btn-primary" onClick={handleCreateGroup}>Create</button>
              </div>
            </div>
          )}
        </div>

        <div className="game-chat">
          {/* Role details are delivered as a highlighted Host DM, not a separate card. */}
                    {viewingHost && roleInfo && room.phase === 'role-card' && (
            <div className={`role-reveal-card ${alignmentClass}`}>
              <div className="role-reveal-label">You are</div>
              <div className="role-reveal-name">{roleInfo.title}</div>
              <p className="role-reveal-desc">{roleInfo.desc}</p>
              {myRole === 'mafia' && (
                <div className="teammate-list">
                  {room.teammates && room.teammates.length > 0 ? (
                    <>
                      <div className="teammate-label">Your fellow Mafia</div>
                      <div className="teammate-names">
                        {room.teammates.map(t => `${t.name}${t.alive ? ' 💀' : ''}`).join(', ')}
                      </div>
                    </>
                  ) : (
                    <span>You are the only Mafia left.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Night action picker — only on Host DM tab, since night actions are private */}
          {viewingHost && room.phase === 'night' && amAlive && hasNightAction && (
            <div className="action-panel action-control">
              {nightActed && nightTargetId === null ? (
                <p>Action submitted — waiting on the timer or other players...</p>
              ) : (
                <>
                  <p>
                    {myRole === 'mafia' && 'Select a player to eliminate:'}
                    {myRole === 'doctor' && 'Select a player to protect:'}
                    {myRole === 'detective' && 'Select a player to investigate:'}
                  </p>
                  <div className="target-buttons">
                    {nightTargets.map((p) => (
                      <button key={p.id} className={`btn-secondary target-btn ${nightTargetId === p.id ? 'is-selected' : ''}`} onClick={() => handleNightTarget(p.id)}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Day discussion notice — only on Town Square */}
          {viewingHost && nightTargetName && (
            <p className="selection-note">You selected <strong>{nightTargetName}</strong> for tonight&apos;s action.</p>
          )}

          {viewingTownSquare && room.phase === 'day' && amAlive && (
            <div className="action-panel">
              <p>Discuss in Town Square. Voting opens when the timer runs out.</p>
            </div>
          )}

          {viewingTownSquare && room.phase === 'starting' && (
            <div className="action-panel important-panel">
              <p>The channel is ready. Your role and instructions will arrive by direct message when the countdown ends.</p>
            </div>
          )}

          {/* Vote picker — only on Town Square, since voting is public */}
          {viewingTownSquare && room.phase === 'voting' && amAlive && (
            <div className="action-panel action-control">
              {voted && voteTargetId === null ? (
                <p>Vote submitted — waiting on the timer or other players...</p>
              ) : (
                <>
                  <p>Vote to eliminate:</p>
                  <div className="target-buttons">
                    {otherAlivePlayers.map((p) => (
                      <button key={p.id} className={`btn-secondary target-btn ${voteTargetId === p.id ? 'is-selected' : ''}`} onClick={() => handleVote(p.id)}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {viewingTownSquare && voteTargetName && (
            <p className="selection-note">You voted for <strong>{voteTargetName}</strong>.</p>
          )}

          {viewingTownSquare && room.phase === 'confirm-vote' && amAlive && (
            <div className="action-panel important-panel">
              {confirmVoted ? (
                <p>Decision submitted — waiting on the timer or other players...</p>
              ) : (
                <>
                  <p>Confirm the elimination of {room.pendingLynch?.name || 'this player'}?</p>
                  <div className="target-buttons">
                    <button className="btn-primary target-btn" onClick={() => handleConfirmVote(true)}>Confirm</button>
                    <button className="btn-secondary target-btn" onClick={() => handleConfirmVote(false)}>Spare</button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="game-chat-log" ref={scrollRef}>
                        {messages.map((m) => {
              const isHostBubble = viewingHost && m.from === 'host';
              const isImportant = m.from === 'Host' || m.from === 'host';
              const isGroupThread = typeof activeThread === 'string' && activeThread.startsWith('group:');
              const senderLabel = activeThread === null
                ? m.from
                : isGroupThread
                  ? (m.from === myId ? 'You' : (m.fromName || 'them'))
                  : (m.from === myId ? playerName : (m.from === 'host' ? 'Host' : 'them'));
              return (
                <div
                  key={m.id}
                  className={`chat-msg ${m.id === highlightId ? 'msg-highlight' : ''} ${isHostBubble ? `host-msg ${alignmentClass}` : ''} ${isImportant ? 'important-message' : ''}`}
                >
                  <strong>{senderLabel}:</strong> {m.text}
                  {m.image && (
                    <img
                      className="chat-msg-image"
                      src={IMAGE_MAP[m.image] || ''}
                      alt={m.image}
                      onLoad={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })}
                    />
                  )}
                </div>
              );
            })}
            {viewingHost && room.phase === 'night' && amAlive && hasNightAction && (
              <div className="chat-msg important-message action-message">
                <strong>Host:</strong> {nightTargetName ? `You selected ${nightTargetName} for tonight's action.` : 'Choose your target for tonight:'}
                <div className="target-buttons">
                  {nightTargets.map((p) => (
                    <button key={p.id} className={`btn-secondary target-btn ${nightTargetId === p.id ? 'is-selected' : ''}`} onClick={() => handleNightTarget(p.id)}>{p.name}</button>
                  ))}
                </div>
              </div>
            )}
            {viewingTownSquare && room.phase === 'voting' && amAlive && (
              <div className="chat-msg important-message action-message">
                <strong>Host:</strong> {voteTargetName ? `You voted for ${voteTargetName}.` : 'Choose the player you want to eliminate:'}
                <div className="target-buttons">
                  {otherAlivePlayers.map((p) => (
                    <button key={p.id} className={`btn-secondary target-btn ${voteTargetId === p.id ? 'is-selected' : ''}`} onClick={() => handleVote(p.id)}>{p.name}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="game-chat-input">
            <input
              className="login-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={!canSendMessage}
              placeholder={!amAlive ? 'You have been eliminated — messaging is locked.' : viewingTownSquare && !canSendMessage ? 'Town Square is locked until daytime.' : activeThread === null ? 'Message Town Square...' : 'Send a private message...'}
            />
            <button className="btn-secondary" onClick={handleSend} disabled={!canSendMessage} style={{ width: 'auto' }}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameRoom;
