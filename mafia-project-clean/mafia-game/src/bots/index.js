import { lowBot } from "./lowBot.js";
import { mediumBot } from "./mediumBot.js";
import { createExpertBot } from "./expertBot.js";

// expert tier is LLM-backed (see expertBot.js) — same interface
// (decideNightAction, decideAccusation, decideVote) as the others,
// but async since it makes an API call.
export const BOTS = {
  low: lowBot,
  medium: mediumBot,
  expert: createExpertBot(),
};