// Best-guess actions based on standard social-deduction mechanics — the
// source (Discord MafiaBot) only lists names/categories, not full rule
// text. Verify each against `/role <name>` and adjust as needed.

export const ROLE_CATEGORIES = [
  {
    category: "Classic",
    roles: [
      { name: "Godfather", alignment: "evil", hasNightAction: true, actionLabel: "order kill",
        description: "Leads the Mafia. Appears innocent to Detective checks; chooses the kill target each night." },
      { name: "Mafia", alignment: "evil", hasNightAction: true, actionLabel: "kill",
        description: "Works with fellow Mafia to eliminate one player each night." },
      { name: "Doctor", alignment: "good", hasNightAction: true, actionLabel: "protect",
        description: "Chooses one player to save from a kill each night." },
      { name: "Detective", alignment: "good", hasNightAction: true, actionLabel: "investigate",
        description: "Checks one player each night to learn if they're Mafia-aligned." },
      { name: "Villager", alignment: "good", hasNightAction: false, actionLabel: null,
        description: "No special ability — wins by helping vote out the Mafia during the day." },
    ],
  },
  {
    category: "Crazy",
    roles: [
      { name: "Vigilante", alignment: "good", hasNightAction: true, actionLabel: "shoot",
        description: "Can shoot and kill one player at night; risks killing a townsperson by mistake." },
      { name: "Mayor", alignment: "good", hasNightAction: false, actionLabel: "reveal",
        description: "Can reveal their identity to double their day-vote weight." },
      { name: "Framer", alignment: "evil", hasNightAction: true, actionLabel: "frame",
        description: "Makes a chosen player appear guilty to the Detective that night." },
      { name: "Executioner", alignment: "neutral", hasNightAction: false, actionLabel: null,
        description: "Wins by getting their assigned target voted out during the day." },
      { name: "Jester", alignment: "neutral", hasNightAction: false, actionLabel: null,
        description: "Wins if voted out by the town during the day." },
    ],
  },
  {
    category: "Chaos",
    roles: [
      { name: "PI", alignment: "good", hasNightAction: true, actionLabel: "compare",
        description: "Checks two players each night to learn if they share the same alignment." },
      { name: "Spy", alignment: "good", hasNightAction: true, actionLabel: "watch",
        description: "Sees who the Mafia targets each night, without learning who the Mafia are." },
      { name: "Distractor", alignment: "good", hasNightAction: true, actionLabel: "distract",
        description: "Roleblocks one player, preventing their night action from happening." },
      { name: "Baiter", alignment: "neutral", hasNightAction: false, actionLabel: null,
        description: "Wins by dying — baits others into causing their own elimination." },
      { name: "Bomber", alignment: "neutral", hasNightAction: true, actionLabel: "plant bomb",
        description: "Rigs a player so that if they're killed, their killer dies too." },
    ],
  },
  {
    category: "Corona",
    roles: [
      { name: "Watcher", alignment: "good", hasNightAction: true, actionLabel: "watch",
        description: "Watches one player's door at night to see who visits them." },
      { name: "Plague Doctor", alignment: "neutral", hasNightAction: true, actionLabel: "infect",
        description: "Infects a player at night; infected players weaken and eventually die unless cured." },
      { name: "Hoarder", alignment: "neutral", hasNightAction: false, actionLabel: "collect",
        description: "Collects charges/items over the game to use later toward their own win." },
      { name: "Hacker", alignment: "evil", hasNightAction: true, actionLabel: "hack",
        description: "Blocks a player's night action, working against the town." },
      { name: "Goose", alignment: "evil", hasNightAction: true, actionLabel: "honk",
        description: "Chaotic disruptive role — causes confusion, e.g. by leaking or scrambling info." },
    ],
  },
  {
    category: "Crimson",
    roles: [
      { name: "Link", alignment: "good", hasNightAction: true, actionLabel: "link",
        description: "Links two players together at night; their fates become tied." },
      { name: "Mimic", alignment: "evil", hasNightAction: true, actionLabel: "mimic",
        description: "Copies another player's appearance or role-claim to confuse the town." },
      { name: "Alchemist", alignment: "unknown", hasNightAction: true, actionLabel: "brew",
        description: "Effect varies per game — confirm current mechanics via /role alchemist." },
    ],
  },
  {
    category: "Premium Exclusive",
    roles: [
      { name: "Isekai", alignment: "neutral", hasNightAction: false, actionLabel: null,
        description: "Premium role — swapped mid-game into a new, randomized role/power." },
      { name: "Santa", alignment: "neutral", hasNightAction: true, actionLabel: "gift",
        description: "Gives a random beneficial or harmful 'gift' to a player each night." },
      { name: "Silencer", alignment: "evil", hasNightAction: true, actionLabel: "silence",
        description: "Prevents a chosen player from speaking or voting the next day." },
      { name: "Gambler", alignment: "good", hasNightAction: true, actionLabel: "bet",
        description: "Bets on another player's fate for a reward or a risk." },
      { name: "Shaman", alignment: "neutral", hasNightAction: true, actionLabel: "commune",
        description: "Can commune with dead players to gain information." },
    ],
  },
];

export const ALIGNMENT_COLORS = {
  good: "#4da6ff",
  evil: "#ff4d4d",
  neutral: "#9a9a9a",
  unknown: "#c084fc",
};