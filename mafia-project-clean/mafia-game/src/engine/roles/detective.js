import { ROLES } from "./index.js";

export const detective = {
  name: "detective",
  faction: "town",
  hasNightAction: true,
  actionLabel: "investigate",

  submitNightAction(gameState, actorId, targetId) {
    gameState.nightActions[actorId] = { action: "investigate", targetId };
  },

  resolveInvestigation(gameState, targetId) {
    const target = gameState.players.find((p) => p.id === targetId);
    if (!target) return null;

    // Framer effect: makes the target read as suspicious regardless of
    // their real faction, for the night it was applied.
    if (gameState.frames && gameState.frames[targetId]) {
      return "suspicious";
    }

    const faction = ROLES[target.role].faction;
    return faction === "mafia" ? "suspicious" : "not suspicious";
  },

  visibleInfoTo(gameState, viewerId) {
    return {};
  },
};