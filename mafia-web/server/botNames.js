// Bot callsign-style display names
const BOT_NAME_POOL = [
  "Armstrong", "Beast", "Buzz", "Casper", "Centice", "Cougar", "Foamer",
  "Gerwin", "Heater", "Hound", "Imp", "Junker", "Marley", "Merlin",
  "Mountain", "Outlaw", "Rainmaker", "Rex", "Sabretooth", "Samara",
  "Shepard", "Squall", "Stinger", "Sultan", "Swabbie", "Tusk", "Wolfman",
  "Ranger", "Ghost", "Talon", "Ironclad", "Falcon", "Reaper", "Nomad",
  "Bishop", "Havoc", "Slate", "Cobra", "Drifter", "Longshot"
];

function pickBotName(usedNames) {
  const available = BOT_NAME_POOL.filter(n => !usedNames.has(n));
  const pool = available.length > 0 ? available : BOT_NAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { pickBotName };