// Expert tier: LLM-backed. Same interface as lowBot/mediumBot
// (decideNightAction, decideAccusation, decideVote) + a new
// decideChat() for human-like talk during discussion phase.
//
// Uses Groq's free API (fast Llama models). Swap GROQ_URL/model
// for Gemini/OpenRouter/Ollama if you want a different provider.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function callLLM(systemPrompt, userPrompt) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 300,
      response_format: { type: "json_object" }, // force parseable output
    }),
  });
  if (!res.ok) throw new Error(`LLM call failed: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

// Builds context from the bot's own memory (per-player notes carried
// across the game, and optionally across games if you persist it to disk).
function buildContext(view, playerId, memory) {
  const alive = view.players.filter((p) => p.alive).map((p) => p.id);
  const recentLog = view.publicLog.slice(-15); // keep prompt small
  const notes = memory.notes[playerId] || {};

  return {
    role: view.self.role,
    self: playerId,
    alivePlayers: alive,
    recentEvents: recentLog,
    privateInfo: view.privateInfo,
    mySuspicionNotes: notes, // e.g. { p3: "voted erratically round 1" }
  };
}

const SYSTEM_PROMPT = `You are an expert Mafia player. Reason carefully about
who is lying based on voting/accusation patterns. Always respond with STRICT
JSON only, matching the schema given in the user message. Never include
commentary outside the JSON.`;

export function createExpertBot(memory = { notes: {} }) {
  return {
    level: "expert",

    async decideNightAction(view, playerId) {
      const ctx = buildContext(view, playerId, memory);
      const schema = `{"targetId": "<playerId or null>", "reasoning": "<1 sentence>"}`;
      const result = await callLLM(
        SYSTEM_PROMPT,
        `Game state: ${JSON.stringify(ctx)}\nChoose your night action target.\nRespond as JSON: ${schema}`
      );
      return result.targetId ? { targetId: result.targetId } : null;
    },

    async decideAccusation(view, playerId) {
      const ctx = buildContext(view, playerId, memory);
      const schema = `{"targetId": "<playerId>", "reasoning": "<1 sentence>"}`;
      const result = await callLLM(
        SYSTEM_PROMPT,
        `Game state: ${JSON.stringify(ctx)}\nWho do you accuse and why?\nRespond as JSON: ${schema}`
      );
      // Persist reasoning as memory for future turns/games — this is your
      // "learning" mechanism: cheap, free, and effective in practice.
      memory.notes[result.targetId] = result.reasoning;
      return result.targetId || null;
    },

    async decideVote(view, playerId) {
      const ctx = buildContext(view, playerId, memory);
      const schema = `{"targetId": "<playerId>"}`;
      const result = await callLLM(
        SYSTEM_PROMPT,
        `Game state: ${JSON.stringify(ctx)}\nFinal vote — who do you eliminate?\nRespond as JSON: ${schema}`
      );
      return result.targetId || null;
    },

    // Optional: human-like chat during discussion. Not part of the
    // low/medium interface, but wire this into your web layer when
    // rendering bot messages in the discussion phase.
    async decideChat(view, playerId) {
      const ctx = buildContext(view, playerId, memory);
      const result = await callLLM(
        `You are a Mafia player chatting casually and persuasively during
         discussion. Sound human — short sentences, occasional typos are
         fine, don't over-explain. Respond as JSON: {"message": "<text>"}`,
        `Game state: ${JSON.stringify(ctx)}\nWrite your next chat message.`
      );
      return result.message;
    },
  };
}