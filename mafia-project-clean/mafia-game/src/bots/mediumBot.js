// Medium tier: rule-based heuristics derived only from what this bot's
// PlayerView legitimately contains — no hidden info, no LLM call.

function aliveOthers(view, excludeId) {
  return view.players.filter((p) => p.alive && p.id !== excludeId);
}

function accusationCounts(view) {
  const counts = {};
  for (const entry of view.publicLog) {
    if (entry.type !== "accusation" || !entry.targetId) continue;
    counts[entry.targetId] = (counts[entry.targetId] || 0) + 1;
  }
  return counts;
}

function mostAccused(view, excludeId) {
  const counts = accusationCounts(view);
  const candidates = aliveOthers(view, excludeId)
    .map((p) => ({ id: p.id, count: counts[p.id] || 0 }))
    .sort((a, b) => b.count - a.count);
  if (candidates.length === 0) return null;
  // If nobody's been accused yet, fall back to random rather than always p0.
  if (candidates[0].count === 0) {
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }
  return candidates[0].id;
}

export const mediumBot = {
  level: "medium",

  decideNightAction(view, playerId) {
    const role = view.self.role;
    const others = aliveOthers(view, playerId);
    if (others.length === 0) return null;

    if (role === "doctor") {
      // Protect self more often than not — simple, exploitable, on purpose
      // (this is what separates "medium" from "expert").
      if (Math.random() < 0.5) return { targetId: playerId };
      return { targetId: others[Math.floor(Math.random() * others.length)].id };
    }

    if (role === "detective") {
      const alreadyChecked = new Set(
        (view.privateInfo.log || [])
          .filter((l) => l.type === "investigation_result")
          .map((l) => l.targetId)
      );
      const unchecked = others.filter((p) => !alreadyChecked.has(p.id));
      const pool = unchecked.length > 0 ? unchecked : others;
      return { targetId: pool[Math.floor(Math.random() * pool.length)].id };
    }

    if (role === "mafia") {
      const teammateIds = new Set((view.privateInfo.mafiaTeammates || []).map((t) => t.id));
      const targets = others.filter((p) => !teammateIds.has(p.id));
      if (targets.length === 0) return null;

      // Kill whoever's been most vocal in accusations (biggest threat to
      // the mafia), falling back to random if no one's accused anyone yet.
      const counts = accusationCounts(view);
      const ranked = targets
        .map((p) => ({ id: p.id, count: counts[p.id] || 0 }))
        .sort((a, b) => b.count - a.count);
      const targetId = ranked[0].count > 0
        ? ranked[0].id
        : targets[Math.floor(Math.random() * targets.length)].id;
      return { targetId };
    }

    return null;
  },

  decideAccusation(view, playerId) {
    // Accuse whoever's currently least-accused among alive others, to
    // avoid all medium bots dogpiling the same person turn one.
    const counts = accusationCounts(view);
    const others = aliveOthers(view, playerId)
      .map((p) => ({ id: p.id, count: counts[p.id] || 0 }))
      .sort((a, b) => a.count - b.count);
    return others.length ? others[0].id : null;
  },

  decideVote(view, playerId) {
    return mostAccused(view, playerId);
  },
};
