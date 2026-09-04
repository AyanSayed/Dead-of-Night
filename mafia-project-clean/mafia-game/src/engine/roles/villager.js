export const villager = {
  name: "villager",
  faction: "town",
  hasNightAction: false,

  // What a player with this role legitimately knows about the game,
  // beyond the public log. Villagers get nothing extra.
  visibleInfoTo(gameState, viewerId) {
    return {};
  },
};
