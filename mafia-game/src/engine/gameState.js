import { ROLES } from "./roles/index.js";

/**
 * playerConfigs: [{ id, name, isHuman, botLevel }]
 * roleCounts: { mafia: 2, doctor: 1, detective: 1, villager: rest }
 */
export function createGame(playerConfigs, roleCounts) {
  const roleList = buildRoleList(playerConfigs.length, roleCounts);
  shuffle(roleList);

  const players = playerConfigs.map((cfg, i) => ({
    id: cfg.id,
    name: cfg.name,
    isHuman: !!cfg.isHuman,
    botLevel: cfg.botLevel || null, // 'low' | 'medium' | 'expert' | 'high'
    role: roleList[i],
    alive: true,
  }));

  return {
    players,
    phase: "night", // 'night' | 'day' | 'vote'
    day: 1,
    publicLog: [], // { day, phase, type, actorId, targetId?, text }
    nightActions: {}, // actorId -> { action, targetId }
    votes: {}, // voterId -> targetId
  };
}

function buildRoleList(playerCount, roleCounts) {
  const list = [];
  for (const [roleName, count] of Object.entries(roleCounts)) {
    if (!ROLES[roleName]) throw new Error(`Unknown role: ${roleName}`);
    for (let i = 0; i < count; i++) list.push(roleName);
  }
  while (list.length < playerCount) list.push("villager");
  if (list.length > playerCount) {
    throw new Error("roleCounts exceed player count");
  }
  return list;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function getPlayer(gameState, playerId) {
  return gameState.players.find((p) => p.id === playerId);
}

export function alivePlayers(gameState) {
  return gameState.players.filter((p) => p.alive);
}

export function logPublic(gameState, entry) {
  gameState.publicLog.push({ day: gameState.day, phase: gameState.phase, ...entry });
}
