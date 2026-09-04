const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const {
  PHASE_DURATION_MS, START_DELAY_MS, NIGHT_REVEAL_DELAY_MS, CONFIRM_VOTE_DURATION_MS,
  createRoom, joinRoom, addBot, removePlayer, getRoomState, getRoomRaw,
  startGame, announceNight, beginNightPhase, getRoleBrief, submitNightAction, isNightComplete, resolveNight,
  startVotingPhase, submitVote, isVoteComplete, resolveVote,
  submitConfirmVote, isConfirmVoteComplete, resolveConfirmVote,
  addPublicMessage, addDirectMessage, getThread, getPlayer,
  createGroup, addGroupMessage, getGroupThread,
} = require('./rooms');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const socketRoomMap = new Map();
const roomTimers = new Map();

function clearRoomTimer(code) {
  const t = roomTimers.get(code);
  if (t) { clearTimeout(t); roomTimers.delete(code); }
}

function scheduleTimer(code, fn, duration = PHASE_DURATION_MS) {
  clearRoomTimer(code);
  const t = setTimeout(fn, duration);
  roomTimers.set(code, t);
}

function broadcastRoom(code) {
  const room = getRoomRaw(code);
  if (!room) return;
  room.players.forEach((p) => {
    if (!p.isBot && p.socketId) {
      io.to(p.socketId).emit('room_update', getRoomState(code, p.id));
    }
  });
}

function sendNightRoleDMs(code) {
  const room = getRoomRaw(code);
  if (!room) return;
  const mafiaPlayers = room.players.filter(p => p.role === 'mafia');

  room.players.forEach((p) => {
    if (!p.isBot && p.alive) {
      let brief = getRoleBrief(p.role);
      if (p.role === 'mafia') {
        const teammates = mafiaPlayers.filter(m => m.id !== p.id).map(m => m.name);
        brief += teammates.length
          ? ` Your fellow Mafia: ${teammates.join(', ')}.`
          : ' You are the only Mafia left.';
      }
      addDirectMessage(code, 'host', p.id, brief, p.role);
      if (p.socketId) {
        io.to(p.socketId).emit('dm_message', {
          id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          from: 'host', to: p.id, text: brief, image: p.role, ts: Date.now(),
        });
      }
    }
  });
}

// --- Bot AI ---

function runBotNightActions(code) {
  const room = getRoomRaw(code);
  if (!room || room.phase !== 'night') return;
  const alivePlayers = room.players.filter(p => p.alive);

  room.players
    .filter(p => p.isBot && p.alive && ['mafia', 'doctor', 'detective'].includes(p.role))
    .forEach((bot) => {
      setTimeout(() => {
        const freshRoom = getRoomRaw(code);
        if (!freshRoom || freshRoom.phase !== 'night') return;
        let candidates = bot.role === 'mafia'
          ? alivePlayers.filter(p => p.role !== 'mafia')
          : alivePlayers.filter(p => p.id !== bot.id || bot.role === 'doctor');
        if (candidates.length === 0) candidates = alivePlayers.filter(p => p.id !== bot.id);
        if (candidates.length === 0) return;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const result = submitNightAction(code, bot.id, target.id);
        if (result.ready) finishNight(code);
      }, 1000 + Math.random() * (PHASE_DURATION_MS - 3000));
    });
}

function runBotDayVotes(code) {
  const room = getRoomRaw(code);
  if (!room || room.phase !== 'voting') return;
  const alivePlayers = room.players.filter(p => p.alive);

  room.players
    .filter(p => p.isBot && p.alive)
    .forEach((bot) => {
      setTimeout(() => {
        const freshRoom = getRoomRaw(code);
        if (!freshRoom || freshRoom.phase !== 'voting') return;
        const candidates = alivePlayers.filter(p => p.id !== bot.id);
        if (candidates.length === 0) return;
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        const result = submitVote(code, bot.id, target.id);
        if (result.ready) finishVote(code);
      }, 1000 + Math.random() * (PHASE_DURATION_MS - 3000));
    });
}

function runBotConfirmVotes(code) {
  const room = getRoomRaw(code);
  if (!room || room.phase !== 'confirm-vote') return;

  room.players
    .filter(p => p.isBot && p.alive)
    .forEach((bot) => {
      setTimeout(() => {
        const freshRoom = getRoomRaw(code);
        if (!freshRoom || freshRoom.phase !== 'confirm-vote') return;
        const choice = Math.random() < 0.7; // bots lean toward confirming
        const result = submitConfirmVote(code, bot.id, choice);
        if (result.ready) finishConfirmVote(code);
      }, 1000 + Math.random() * (CONFIRM_VOTE_DURATION_MS - 3000));
    });
}

// --- Phase transitions ---

// Step 0 (first night only): silent 5s buffer after "Start Game" is clicked.
function runNightAnnouncement(code) {
  clearRoomTimer(code);
  const result = announceNight(code);
  if (result.error) return;
  broadcastRoom(code);
  scheduleTimer(code, () => openNightActions(code), NIGHT_REVEAL_DELAY_MS);
}

// Step 2: 5s after the announcement — actually reveal roles via DM and open
// the night action window. Shared by the first night and every night after.
function openNightActions(code) {
  clearRoomTimer(code);
  const result = beginNightPhase(code);
  if (result.error) return;
  broadcastRoom(code);
  sendNightRoleDMs(code);
  runBotNightActions(code);
  scheduleTimer(code, () => finishNight(code));
}

function finishNight(code) {
  clearRoomTimer(code);
  const resolved = resolveNight(code);
  broadcastRoom(code);
  if (resolved.room.phase === 'day') {
    scheduleTimer(code, () => finishDay(code));
  }
}

function finishDay(code) {
  clearRoomTimer(code);
  const result = startVotingPhase(code);
  if (result.error) return;
  broadcastRoom(code);
  runBotDayVotes(code);
  scheduleTimer(code, () => finishVote(code));
}

function finishVote(code) {
  clearRoomTimer(code);
  const resolved = resolveVote(code);
  broadcastRoom(code);
  if (resolved.room.phase === 'night-announce') {
    scheduleTimer(code, () => openNightActions(code), NIGHT_REVEAL_DELAY_MS);
  }
}

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('create_room', ({ hostName }) => {
    const room = createRoom(socket.id, hostName);
    socket.join(room.code);
    socketRoomMap.set(socket.id, room.code);
    socket.emit('room_created', getRoomState(room.code, socket.id));
  });

  socket.on('join_room', ({ code, name }) => {
    const result = joinRoom(code, socket.id, name);
    if (result.error) { socket.emit('join_error', result.error); return; }
    socket.join(code);
    socketRoomMap.set(socket.id, code);
    broadcastRoom(code);
  });

  socket.on('add_bot', ({ code }) => {
    const result = addBot(code);
    if (result.error) { socket.emit('join_error', result.error); return; }
    broadcastRoom(code);
  });

  socket.on('start_game', ({ code }) => {
    const result = startGame(code, socket.id);
    if (result.error) { socket.emit('join_error', result.error); return; }
    broadcastRoom(code);
    scheduleTimer(code, () => runNightAnnouncement(code), START_DELAY_MS);
  });

  socket.on('send_public_message', ({ code, text }) => {
    const player = getPlayer(code, socket.id);
    const from = player ? player.name : 'Unknown';
    const result = addPublicMessage(code, from, text);
    if (result.error) return;
    io.to(code).emit('public_message', result.message);
  });

  socket.on('send_dm', ({ code, toId, text }) => {
    const result = addDirectMessage(code, socket.id, toId, text);
    if (result.error) return;
    socket.emit('dm_message', result.message);
    io.to(toId).emit('dm_message', result.message);
  });

  socket.on('get_dm_thread', ({ code, otherId }) => {
    const thread = getThread(code, socket.id, otherId);
    socket.emit('dm_thread', { otherId, thread });
  });

  socket.on('create_group', ({ code, name, memberIds }) => {
    const result = createGroup(code, socket.id, name, memberIds);
    if (result.error) { socket.emit('join_error', result.error); return; }
    broadcastRoom(code);
  });

  socket.on('get_group_thread', ({ code, groupId }) => {
    const thread = getGroupThread(code, groupId);
    socket.emit('group_thread', { groupId, thread });
  });

  socket.on('send_group_message', ({ code, groupId, text }) => {
    const player = getPlayer(code, socket.id);
    const from = player ? player.name : 'Unknown';
    const result = addGroupMessage(code, groupId, socket.id, from, text);
    if (result.error) { socket.emit('join_error', result.error); return; }
    result.group.memberIds.forEach((memberId) => {
      const member = getPlayer(code, memberId);
      if (member && !member.isBot && member.socketId) {
        io.to(member.socketId).emit('group_message', result.message);
      }
    });
  });

  socket.on('submit_night_action', ({ code, targetId }) => {
    const result = submitNightAction(code, socket.id, targetId);
    if (result.error) { socket.emit('join_error', result.error); return; }
    socket.emit('night_action_confirmed', { targetId });
    if (result.ready) finishNight(code);
  });

  socket.on('submit_vote', ({ code, targetId }) => {
    const result = submitVote(code, socket.id, targetId);
    if (result.error) { socket.emit('join_error', result.error); return; }
    socket.emit('vote_confirmed', { targetId });
    if (result.ready) finishVote(code);
  });

  socket.on('disconnect', () => {
    const code = socketRoomMap.get(socket.id);
    if (code) {
      removePlayer(code, socket.id);
      broadcastRoom(code);
      socketRoomMap.delete(socket.id);
    }
    console.log('Disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});