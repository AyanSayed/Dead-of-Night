import { ROLES } from "./roles/index.js";

/**
 * Returns 'town' | 'mafia' | 'jester' | 'executioner' | null (game continues)
 * lastEliminated: the player object voted out this round (or null), passed
 * in so Jester/Executioner can check if their win condition just triggered.
 */
export function checkWinCondition(gameState, lastEliminated = null) {
  if (lastEliminated) {
    const eliminatedPlayer = gameState.players.find((p) => p.id === lastEliminated.id);
    if (eliminatedPlayer?.role === "jester") return "jester";

    const executioner = gameState.players.find(
      (p) => p.role === "executioner" && p.executionerTargetId === lastEliminated.id
    );
    if (executioner) return "executioner";
  }

  const alive = gameState.players.filter((p) => p.alive);
  const aliveMafia = alive.filter((p) => ROLES[p.role].faction === "mafia");
  const aliveTown = alive.filter((p) => ROLES[p.role].faction === "town");

  if (aliveMafia.length === 0) return "town";
  if (aliveMafia.length >= aliveTown.length) return "mafia";
  return null;
}