// Low tier: no strategy. Valid but effectively random. This is the baseline
// every other tier should be a clear step up from.

function randomOtherAlive(view, excludeId) {
  const candidates = view.players.filter((p) => p.alive && p.id !== excludeId);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

export const lowBot = {
  level: "low",

  decideNightAction(view, playerId) {
    // Villagers etc. have no night action; caller only invokes this for
    // roles that do (checked via ROLES[role].hasNightAction upstream).
    const targetId = randomOtherAlive(view, playerId);
    return targetId ? { targetId } : null;
  },

  decideAccusation(view, playerId) {
    return randomOtherAlive(view, playerId);
  },

  decideVote(view, playerId) {
    return randomOtherAlive(view, playerId);
  },
};
