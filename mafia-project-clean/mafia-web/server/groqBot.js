require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const ROLE_CONTEXT = {
  mafia: `You are secretly Mafia. Do NOT reveal this. Act like an innocent villager, deflect suspicion, and subtly cast doubt on real villagers without being obvious.`,
  doctor: `You are the Doctor but keep this secret. Talk like a regular villager trying to find the Mafia.`,
  detective: `You are the Detective but keep this secret unless you want to carefully hint at findings. Talk like a villager trying to find the Mafia.`,
  villager: `You are an ordinary Villager with no special role. Reason out loud about who might be Mafia based on the discussion.`,
};

async function generateBotMessage(room, bot) {
  if (!GROQ_API_KEY) {
    console.warn('[groqBot] GROQ_API_KEY not set — skipping bot chat');
    return null;
  }

  const alivePlayers = room.players.filter(p => p.alive).map(p => p.name);
  const deadPlayers = room.players.filter(p => !p.alive).map(p => p.name);
  const recentLog = room.publicLog.slice(-12).map(m => `${m.from}: ${m.text}`).join('\n');

  const systemPrompt = `You are ${bot.name}, a player in an online Mafia (Werewolf) game.
${ROLE_CONTEXT[bot.role] || ROLE_CONTEXT.villager}
Stay in character. Keep it short — 1-2 casual sentences, like a real chat message. No quotation marks, no "as an AI" framing, never reveal you're a bot.
Alive players: ${alivePlayers.join(', ')}.
${deadPlayers.length ? `Eliminated: ${deadPlayers.join(', ')}.` : ''}`;

  const userPrompt = `Recent town chat:\n${recentLog || '(no messages yet)'}\n\nWrite your next chat message. Under 30 words.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.9,
        max_tokens: 60,
      }),
    });

    if (!res.ok) {
      console.error('[groqBot] Groq API error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[groqBot] fetch failed:', err.message);
    return null;
  }
}

module.exports = { generateBotMessage };