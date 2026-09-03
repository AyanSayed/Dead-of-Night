import { lowBot } from "./lowBot.js";
import { mediumBot } from "./mediumBot.js";

// expert/high tiers plug in here later — same interface
// (decideNightAction, decideAccusation, decideVote), just backed by an LLM
// call instead of pure heuristics.
export const BOTS = {
  low: lowBot,
  medium: mediumBot,
};
