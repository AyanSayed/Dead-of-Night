export const doctor = {
  name: "doctor",
  faction: "town",
  hasNightAction: true,
  actionLabel: "protect",

  // Record the intended action; resolution happens centrally in phaseController
  // so doctor + mafia + detective actions resolve in a consistent, server-decided order.
  submitNightAction(gameState, actorId, targetId) {
    gameState.nightActions[actorId] = { action: "protect", targetId };
  },

  visibleInfoTo(gameState, viewerId) {
    // Doctor doesn't learn anything passively beyond result of their own action,
    // which phaseController appends to their private log during resolution.
    return {};
  },
};
