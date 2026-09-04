# AI Mafia — V1

Engine + Low/Medium rule-based bots, playable via CLI. No LLM, no UI, no networking yet — on purpose (see chat).

## Run

```
npm run play
```

You play as `p1` against 2 low-tier and 3 medium-tier bots (2 mafia, 1 doctor, 1 detective, 2 villagers among 6 players).

## Structure

```
src/engine/          game engine — no bot or UI code allowed in here
  gameState.js        creates game, role assignment, alive/log helpers
  playerView.js        <-- the info-isolation choke point. Every player
                            (human or bot, any tier) reads state ONLY
                            through getPlayerView(). Nothing else should
                            hand out raw gameState.
  winConditions.js     town vs mafia win check
  phaseController.js   resolves night actions (protect->kill->investigate
                        order) and votes; advances phases
  roles/                one file per role — add a role by adding a file
    index.js            + one line in ROLES registry. Nothing else changes.
    villager.js / doctor.js / detective.js / mafia.js

src/bots/             AI players — consume PlayerView only, same as a human
  lowBot.js            near-random valid decisions
  mediumBot.js         rule-based: tracks public accusations, doctor
                        self-protects ~50%, mafia targets loudest accuser
  index.js             registry — expert/high (LLM-backed) tiers plug in
                        here later behind the same 3-method interface:
                        decideNightAction / decideAccusation / decideVote

src/cli/play.js       orchestrator loop. This is the only place that knows
                        about "the game" end to end — engine and bots don't
                        know about each other beyond the shared interfaces.
```

## Next steps (not built yet, on purpose)

- Expert/High bot tiers: same 3-method interface, backed by an LLM call
  against `getPlayerView()` output instead of heuristics
- Real chat instead of single accusation-per-round
- Web UI instead of CLI
- Persistent memory across games
