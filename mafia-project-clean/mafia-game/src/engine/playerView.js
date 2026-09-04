import { ROLES } from "./roles/index.js";
import { getPlayer } from "./gameState.js";

/**
 * The single choke point for information isolation.
 * Every player (human or bot, any tier) reads the game ONLY through this.
 * Nothing else in the codebase should hand a player the raw gameState.
 */
export function getPlayerView(gameState, playerId) {
  const viewer = getPlayer(gameState, playerId);
  if (!viewer) throw new Error(`Unknown player: ${playerId}`);

  const roleDef = ROLES[viewer.role];

  return {
    // Public, anyone-can-see info
    day: gameState.day,
    phase: gameState.phase,
    players: gameState.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      // role is NEVER exposed here for other players, alive or dead,
      // except through each role's own visibleInfoTo() grant below.
    })),
    publicLog: gameState.publicLog,

    // Private, viewer-specific info
    self: {
      id: viewer.id,
      role: viewer.role,
      faction: roleDef.faction,
      alive: viewer.alive,
    },
    privateInfo: {
      ...roleDef.visibleInfoTo(gameState, playerId),
      ...(viewer.privateLog ? { log: viewer.privateLog } : {}),
    },
  };
}
