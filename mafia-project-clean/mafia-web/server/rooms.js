const { pickBotName } = require('./botNames');

const PHASE_DURATION_MS = 30000;     // 30s — action/discussion/vote windows
const START_DELAY_MS = 5000;         // 5s — visible start countdown before roles are sent
const NIGHT_REVEAL_DELAY_MS = 5000;  // 5s — between later night announcements and their role reminders
const DAY_REVEAL_DELAY_MS = 5000;    // 5s — let the town read the sunrise narration
const CONFIRM_VOTE_DURATION_MS = 15000; // 15s — window to confirm/spare whoever got the most votes

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom(hostSocketId, hostName) {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();

  const room = {
    code,
    hostSocketId,
    status: 'waiting',
    phase: 'waiting',      // 'waiting' | 'starting' | 'night' | 'day' | 'voting' | 'confirm-vote' | 'ended'
    round: 0,
    winner: null,
    phaseEndsAt: null,
    players: [
      { id: hostSocketId, name: hostName, isBot: false, socketId: hostSocketId, role: null, alive: true }
    ],
    publicLog: [],
    dms: {},
    groups: {},
    groupMessages: {},
    nightActions: {},
    pendingLynchId: null,
    confirmVotes: {},
    dayVotes: {},
    lastNightResult: null,
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, name) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'waiting') return { error: 'Game already started' };
  room.players.push({ id: socketId, name, isBot: false, socketId, role: null, alive: true });
  return { room };
}

function addBot(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'waiting') return { error: 'Game already started' };
  const usedNames = new Set(room.players.map(p => p.name));
  const name = pickBotName(usedNames);
  const botId = 'bot-' + Math.random().toString(36).slice(2, 9);
  room.players.push({ id: botId, name, isBot: true, socketId: null, role: null, alive: true });
  return { room };
}

function removePlayer(code, socketId) {
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter(p => p.socketId !== socketId);
  if (room.players.length === 0) rooms.delete(code);
  return room;
}

// --- Role assignment ---------------------------------------------------

function buildRoleList(playerCount) {
  const mafiaCount = playerCount <= 5 ? 1 : playerCount <= 8 ? 2 : 3;
  const doctorCount = playerCount >= 4 ? 1 : 0;
  const detectiveCount = playerCount >= 5 ? 1 : 0;
  const list = [];
  for (let i = 0; i < mafiaCount; i++) list.push('mafia');
  for (let i = 0; i < doctorCount; i++) list.push('doctor');
  for (let i = 0; i < detectiveCount; i++) list.push('detective');
  while (list.length < playerCount) list.push('villager');
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const ROLE_BRIEFS = {
  mafia: "ROLE: Mafia. ACTION: Each night, choose a living non-Mafia player to eliminate. WIN: Mafia wins when the number of living Mafia equals or exceeds the living town.",
  doctor: "ROLE: Doctor. ACTION: Each night, choose one living player to protect; you may protect yourself. WIN: Town wins by eliminating every Mafia member.",
  detective: "ROLE: Detective. ACTION: Each night, investigate one living player. I will tell you whether your selected target is Mafia. WIN: Town wins by eliminating every Mafia member.",
  villager: "ROLE: Villager. ACTION: You have no night action; discuss during the day and vote carefully. WIN: Town wins by eliminating every Mafia member.",
};

// Called the instant the host clicks "Start Game". The town channel stays
// available during a five-second countdown; roles are then sent by DM.
function startGame(code, requesterSocketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostSocketId !== requesterSocketId) return { error: 'Only the host can start the game' };
  if (room.status !== 'waiting') return { error: 'Game already started' };
  if (room.players.length < 3) return { error: 'Need at least 3 players to start' };

  const roles = buildRoleList(room.players.length);
  room.players.forEach((p, i) => { p.role = roles[i]; p.alive = true; });

  room.status = 'in-progress';
  room.publicLog = [];
  room.round = 1;
  room.phase = 'starting';
  room.phaseEndsAt = Date.now() + START_DELAY_MS;
  room.nightActions = {};
  room.dayVotes = {};
  room.pendingLynchId = null;
  room.confirmVotes = {};
  room.winner = null;
  addPublicMessage(code, 'Host', 'The game will start in 5 seconds. Get ready!');

  return { room };
}

// Step 1 of the night sequence: post the "night falls" announcement (with the
// night image) but do NOT reveal roles yet — that happens NIGHT_REVEAL_DELAY_MS
// later, via beginNightPhase(). Used for the game's first night AND every
// night after a day/vote cycle.
function announceNight(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  room.phase = 'night-announce';
  room.phaseEndsAt = Date.now() + NIGHT_REVEAL_DELAY_MS;
  addPublicMessage(code, 'Host', `Night falls on the town. Everyone, close your eyes and check your DMs for your role...`, 'night');
  return { room };
}

// Step 2 of the night sequence: actually opens the night action window and
// (in index.js) triggers the private role DMs.
function beginNightPhase(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'night-announce') return { error: 'Not in night-announce phase' };

  room.phase = 'night';
  room.phaseEndsAt = Date.now() + PHASE_DURATION_MS;
  return { room };
}

function getRoleBrief(role) {
  return ROLE_BRIEFS[role] || '';
}

// --- Night actions -------------------------------------------------------

function submitNightAction(code, actorId, targetId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'night') return { error: 'Not night phase' };
  const actor = room.players.find(p => p.id === actorId);
  if (!actor || !actor.alive) return { error: 'Invalid actor' };
  if (!['mafia', 'doctor', 'detective'].includes(actor.role)) return { error: 'Your role has no night action' };
  const target = room.players.find(p => p.id === targetId);
  if (!target || !target.alive) return { error: 'Invalid target' };
  room.nightActions[actorId] = targetId;
  return { room, ready: isNightComplete(room) };
}

function isNightComplete(room) {
  const actors = room.players.filter(p => p.alive && ['mafia', 'doctor', 'detective'].includes(p.role));
  return actors.every(p => room.nightActions[p.id] !== undefined);
}

function resolveNight(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };

  const alive = () => room.players.filter(p => p.alive);
  const mafiaAlive = alive().filter(p => p.role === 'mafia');
  const killTally = {};
  mafiaAlive.forEach(m => {
    const t = room.nightActions[m.id];
    if (t) killTally[t] = (killTally[t] || 0) + 1;
  });
  let killTargetId = null, maxVotes = 0;
  Object.entries(killTally).forEach(([targetId, count]) => {
    if (count > maxVotes) { maxVotes = count; killTargetId = targetId; }
  });

  const doctor = alive().find(p => p.role === 'doctor');
  const saveTargetId = doctor ? room.nightActions[doctor.id] : null;

  const detective = alive().find(p => p.role === 'detective');
  const checkTargetId = detective ? room.nightActions[detective.id] : null;

  let killedPlayer = null;
  if (killTargetId && killTargetId !== saveTargetId) {
    const victim = room.players.find(p => p.id === killTargetId);
    if (victim) { victim.alive = false; killedPlayer = victim; }
  }

  room.lastNightResult = { killedId: killedPlayer ? killedPlayer.id : null, savedId: saveTargetId };

  if (killedPlayer) {
    addPublicMessage(code, 'Host', `The sun rises. ${killedPlayer.name} was found dead. They were a ${killedPlayer.role}.`, 'day');
  } else {
    addPublicMessage(code, 'Host', `The sun rises. Nobody died last night.`, 'day');
  }

  if (killedPlayer) addPublicMessage(code, 'Host', getDeathStory(killedPlayer.name));

  if (detective && checkTargetId) {
    const checkedPlayer = room.players.find(p => p.id === checkTargetId);
    if (checkedPlayer) {
      const result = checkedPlayer.role === 'mafia'
        ? `Yes — your selected target, ${checkedPlayer.name}, is Mafia.`
        : `No — your selected target, ${checkedPlayer.name}, is not Mafia.`;
      addDirectMessage(code, 'host', detective.id, result);
    }
  }

  room.nightActions = {};

  const win = checkWinCondition(room);
  if (win) {
    room.phase = 'ended';
    room.status = 'ended';
    room.winner = win;
    room.phaseEndsAt = null;
    addPublicMessage(code, 'Host', win === 'mafia' ? 'The Mafia have taken over the town. Mafia wins!' : 'The town has eliminated all Mafia. Town wins!');
    return { room };
  }

  room.phase = 'day-announce';
  room.phaseEndsAt = Date.now() + DAY_REVEAL_DELAY_MS;
  return { room };
}

function beginDayDiscussion(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'day-announce') return { error: 'Not in day announcement phase' };
  room.phase = 'day';
  room.phaseEndsAt = Date.now() + PHASE_DURATION_MS;
  addPublicMessage(code, 'Host', 'Discussion is now open. Talk in Town Square before voting begins.', 'day');
  return { room };
}

// --- Day discussion -> voting transition ------------------------------------

function startVotingPhase(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'day') return { error: 'Not day phase' };

  room.phase = 'voting';
  room.phaseEndsAt = Date.now() + PHASE_DURATION_MS;
  room.dayVotes = {};
  addPublicMessage(code, 'Host', 'Voting is now open. Choose who to eliminate.', 'voting');
  return { room };
}

// --- Voting ------------------------------------------------------------

function submitVote(code, voterId, targetId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'voting') return { error: 'Not voting phase' };
  const voter = room.players.find(p => p.id === voterId);
  if (!voter || !voter.alive) return { error: 'Invalid voter' };
  const target = room.players.find(p => p.id === targetId);
  if (!target || !target.alive) return { error: 'Invalid target' };
  room.dayVotes[voterId] = targetId;
  return { room, ready: isVoteComplete(room) };
}

function isVoteComplete(room) {
  const alivePlayers = room.players.filter(p => p.alive);
  return alivePlayers.every(p => room.dayVotes[p.id] !== undefined);
}

function resolveVote(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };

  const tally = {};
  Object.values(room.dayVotes).forEach(targetId => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  let lynchedId = null, maxVotes = 0, tie = false;
  Object.entries(tally).forEach(([targetId, count]) => {
    if (count > maxVotes) { maxVotes = count; lynchedId = targetId; tie = false; }
    else if (count === maxVotes && maxVotes > 0) { tie = true; }
  });

  room.dayVotes = {};

  if (lynchedId && !tie) {
    const lynched = room.players.find(p => p.id === lynchedId);
    // Don't eliminate yet — open a 15s confirm window so the town can back out.
    room.phase = 'confirm-vote';
    room.pendingLynchId = lynchedId;
    room.confirmVotes = {};
    room.phaseEndsAt = Date.now() + CONFIRM_VOTE_DURATION_MS;
    addPublicMessage(code, 'Host', `${lynched.name} received the most votes. Confirm: should they be eliminated?`, 'voting');
    return { room };
  }

  addPublicMessage(code, 'Host', 'The vote ended with no majority. No one is eliminated today.');

  const win = checkWinCondition(room);
  if (win) {
    room.phase = 'ended';
    room.status = 'ended';
    room.winner = win;
    room.phaseEndsAt = null;
    addPublicMessage(code, 'Host', win === 'mafia' ? 'The Mafia have taken over the town. Mafia wins!' : 'The town has eliminated all Mafia. Town wins!');
    return { room };
  }

  room.round += 1;
  room.nightActions = {};
  announceNight(code);
  return { room };
}

// --- Confirm-vote (runoff after the day vote picks a target) -----------

function submitConfirmVote(code, voterId, choice) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase !== 'confirm-vote') return { error: 'Not confirm-vote phase' };
  const voter = room.players.find(p => p.id === voterId);
  if (!voter || !voter.alive) return { error: 'Invalid voter' };
  room.confirmVotes[voterId] = !!choice;
  return { room, ready: isConfirmVoteComplete(room) };
}

function isConfirmVoteComplete(room) {
  const alivePlayers = room.players.filter(p => p.alive);
  return alivePlayers.every(p => room.confirmVotes[p.id] !== undefined);
}

function resolveConfirmVote(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };

  const target = room.players.find(p => p.id === room.pendingLynchId);
  const choices = Object.values(room.confirmVotes);
  const yesCount = choices.filter(Boolean).length;
  const noCount = choices.length - yesCount;

  if (target && yesCount > noCount) {
    target.alive = false;
    addPublicMessage(code, 'Host', `The town has confirmed it. ${target.name} was voted out. They were a ${target.role}.`, 'eliminated');
  } else if (target) {
    addPublicMessage(code, 'Host', `The town has decided to spare ${target.name}. No one is eliminated today.`);
  }

  room.confirmVotes = {};
  room.pendingLynchId = null;

  const win = checkWinCondition(room);
  if (win) {
    room.phase = 'ended';
    room.status = 'ended';
    room.winner = win;
    room.phaseEndsAt = null;
    addPublicMessage(code, 'Host', win === 'mafia' ? 'The Mafia have taken over the town. Mafia wins!' : 'The town has eliminated all Mafia. Town wins!');
    return { room };
  }

  room.round += 1;
  room.nightActions = {};
  announceNight(code);
  return { room };
}

function checkWinCondition(room) {
  const alivePlayers = room.players.filter(p => p.alive);
  const mafiaAlive = alivePlayers.filter(p => p.role === 'mafia').length;
  const townAlive = alivePlayers.length - mafiaAlive;
  if (mafiaAlive === 0) return 'town';
  if (mafiaAlive >= townAlive) return 'mafia';
  return null;
}

// --- Messaging -----------------------------------------------------------

function addPublicMessage(code, from, text, image = null) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), from, text, image, ts: Date.now() };
  room.publicLog.push(msg);
  return { message: msg };
}

function dmKey(idA, idB) { return [idA, idB].sort().join('|'); }

function addDirectMessage(code, fromId, toId, text, image = null) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const key = dmKey(fromId, toId);
  if (!room.dms[key]) room.dms[key] = [];
  const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), from: fromId, to: toId, text, image, ts: Date.now() };
  room.dms[key].push(msg);
  return { message: msg };
}

// --- Groups (private player-created chats, visible only to members) -----

function createGroup(code, ownerId, name, memberIds) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const ids = new Set(memberIds || []);
  ids.add(ownerId);
  const validIds = [...ids].filter(id => room.players.some(p => p.id === id));
  if (validIds.length < 2) return { error: 'Pick at least one other member' };
  const groupId = 'grp-' + Math.random().toString(36).slice(2, 9);
  if (!room.groups) room.groups = {};
  if (!room.groupMessages) room.groupMessages = {};
  room.groups[groupId] = { id: groupId, name: (name || 'Group').slice(0, 40), ownerId, memberIds: validIds };
  room.groupMessages[groupId] = [];
  return { room, group: room.groups[groupId] };
}

function addGroupMessage(code, groupId, fromId, fromName, text) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const group = room.groups && room.groups[groupId];
  if (!group) return { error: 'Group not found' };
  if (!group.memberIds.includes(fromId)) return { error: 'Not a member of this group' };
  const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), groupId, from: fromId, fromName, text, ts: Date.now() };
  room.groupMessages[groupId].push(msg);
  return { message: msg, group };
}

function getGroupThread(code, groupId, playerId) {
  const room = rooms.get(code);
  const group = room && room.groups && room.groups[groupId];
  if (!group || !group.memberIds.includes(playerId)) return null;
  return (room.groupMessages && room.groupMessages[groupId]) || [];
}

function resetRoomForReplay(code) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  room.status = 'waiting';
  room.phase = 'waiting';
  room.round = 0;
  room.winner = null;
  room.phaseEndsAt = null;
  room.publicLog = [];
  room.dms = {};
  room.groups = {};
  room.groupMessages = {};
  room.nightActions = {};
  room.dayVotes = {};
  room.confirmVotes = {};
  room.pendingLynchId = null;
  room.lastNightResult = null;
  room.players.forEach((p) => { p.role = null; p.alive = true; });
  return { room };
}

function getThread(code, idA, idB) {
  const room = rooms.get(code);
  if (!room) return [];
  return room.dms[dmKey(idA, idB)] || [];
}

function getPlayer(code, playerId) {
  const room = rooms.get(code);
  if (!room) return null;
  return room.players.find(p => p.id === playerId) || null;
}

function getRoomState(code, forPlayerId) {
  const room = rooms.get(code);
  if (!room) return null;
  const me = room.players.find(p => p.id === forPlayerId);
  // Roles are assigned the instant "Start Game" is clicked, but the client
  // isn't told until the night reveal actually fires.
  const revealed = !['waiting', 'starting', 'night-announce'].includes(room.phase);
  const teammates = (revealed && me && me.role === 'mafia')
    ? room.players
        .filter(p => p.role === 'mafia' && p.id !== forPlayerId)
        .map(p => ({ id: p.id, name: p.name, alive: p.alive }))
    : [];
  const groups = room.groups
    ? Object.values(room.groups)
        .filter(g => g.memberIds.includes(forPlayerId))
        .map(g => ({
          id: g.id,
          name: g.name,
          memberIds: g.memberIds,
          memberNames: g.memberIds.map(id => (room.players.find(p => p.id === id) || {}).name),
        }))
    : [];
  const pendingLynch = room.pendingLynchId
    ? (() => {
        const p = room.players.find(pl => pl.id === room.pendingLynchId);
        return p ? { id: p.id, name: p.name } : null;
      })()
    : null;

  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    round: room.round,
    winner: room.winner,
    phaseEndsAt: room.phaseEndsAt,
    hostId: room.hostSocketId,
    myRole: revealed && me ? me.role : null,
    teammates,
    groups,
    pendingLynch,
    players: room.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot, alive: p.alive })),
    publicLog: room.publicLog,
  };
}

function getRoomRaw(code) { return rooms.get(code); }

module.exports = {
  PHASE_DURATION_MS, START_DELAY_MS, NIGHT_REVEAL_DELAY_MS, DAY_REVEAL_DELAY_MS, CONFIRM_VOTE_DURATION_MS,
  createRoom, joinRoom, addBot, removePlayer, getRoomState, getRoomRaw,
  startGame, announceNight, beginNightPhase, beginDayDiscussion, getRoleBrief, submitNightAction, isNightComplete, resolveNight,
  startVotingPhase, submitVote, isVoteComplete, resolveVote,
  submitConfirmVote, isConfirmVoteComplete, resolveConfirmVote,
  addPublicMessage, addDirectMessage, getThread, getPlayer,
  createGroup, addGroupMessage, getGroupThread, resetRoomForReplay,
};

const DEATH_STORIES = [
  '{name} was last seen wandering the empty streets after midnight. By dawn, only a dropped lantern remained.',
  'A neighbour heard hurried footsteps and a door slam. At sunrise, {name} had vanished into the night forever.',
  '{name} took a shortcut through the foggy square. The Mafia were waiting in the shadows.',
  'The town found {name} beneath a flickering streetlamp, with no witnesses brave enough to speak.',
  '{name} went out for one last late-night walk. The silence of the street told the rest of the story.',
];

function getDeathStory(name) {
  const story = DEATH_STORIES[Math.floor(Math.random() * DEATH_STORIES.length)];
  return story.replace('{name}', name);
}
