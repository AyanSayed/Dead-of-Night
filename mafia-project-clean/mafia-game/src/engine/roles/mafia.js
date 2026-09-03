export const mafia = {
  name: "mafia",
  faction: "mafia",
  hasNightAction: true,
  actionLabel: "kill",

  submitNightAction(gameState, actorId, targetId) {
    gameState.nightActions[actorId] = { action: "kill", targetId };
  },

  // Mafia legitimately know their faction teammates. This is the ONE case
  // where visibleInfoTo reveals another player's hidden role — everything
  // else stays private per the isolation rule.
  visibleInfoTo(gameState, viewerId) {
    const teammates = gameState.players
      .filter((p) => p.id !== viewerId && p.role === "mafia")
      .map((p) => ({ id: p.id, name: p.name }));
    return { mafiaTeammates: teammates };
  },
};
