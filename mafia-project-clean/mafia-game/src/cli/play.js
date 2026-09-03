import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { createGame, alivePlayers, logPublic } from "../engine/gameState.js";
import { getPlayerView } from "../engine/playerView.js";
import { resolveNight, resolveVote } from "../engine/phaseController.js";
import { ROLES } from "../engine/roles/index.js";
import { BOTS } from "../bots/index.js";

const rl = readline.createInterface({ input: stdin, output: stdout });

// --- Setup: 1 human + 5 bots, mixed tiers, 6-player classic game ---
const playerConfigs = [
  { id: "p1", name: "You", isHuman: true },
  { id: "p2", name: "Riya", botLevel: "low" },
  { id: "p3", name: "Kabir", botLevel: "low" },
  { id: "p4", name: "Zoya", botLevel: "medium" },
  { id: "p5", name: "Dev", botLevel: "medium" },
  { id: "p6", name: "Ana", botLevel: "medium" },
];
const roleCounts = { mafia: 2, doctor: 1, detective: 1 }; // rest -> villager

const game = createGame(playerConfigs, roleCounts);

async function chooseTarget(view, playerId, promptLabel, options) {
  const player = playerConfigs.find((p) => p.id === playerId);
  if (!player.isHuman) return null; // handled by bot logic elsewhere

  console.log(`\n${promptLabel} — options:`);
  options.forEach((o, i) => console.log(`  ${i + 1}. ${o.name}`));
  const answer = await rl.question("> ");
  const idx = parseInt(answer, 10) - 1;
  return options[idx] ? options[idx].id : options[0]?.id ?? null;
}

async function nightPhase() {
  console.log(`\n=== NIGHT ${game.day} ===`);
  for (const player of alivePlayers(game)) {
    const roleDef = ROLES[player.role];
    if (!roleDef.hasNightAction) continue;

    const view = getPlayerView(game, player.id);
    const options = view.players.filter((p) => p.alive && p.id !== player.id);

    let targetId;
    if (player.isHuman) {
      targetId = await chooseTarget(view, player.id, `[${player.role}] Choose your target`, options);
    } else {
      const bot = BOTS[player.botLevel];
      const decision = bot.decideNightAction(view, player.id);
      targetId = decision?.targetId ?? null;
    }
    if (targetId) roleDef.submitNightAction(game, player.id, targetId);
  }

  const winner = resolveNight(game);
  printNewPublicLog();
  return winner;
}

async function dayPhase() {
  console.log(`\n=== DAY ${game.day} — discussion ===`);
  for (const player of alivePlayers(game)) {
    const view = getPlayerView(game, player.id);
    const options = view.players.filter((p) => p.alive && p.id !== player.id);

    let targetId;
    if (player.isHuman) {
      targetId = await chooseTarget(view, player.id, "Who do you accuse? (or blank to stay quiet)", options);
    } else {
      targetId = BOTS[player.botLevel].decideAccusation(view, player.id);
    }
    if (targetId) {
      const target = game.players.find((p) => p.id === targetId);
      logPublic(game, {
        type: "accusation",
        actorId: player.id,
        targetId,
        text: `${player.name} accuses ${target.name}.`,
      });
    }
  }
  printNewPublicLog();
}

async function votePhase() {
  console.log(`\n=== DAY ${game.day} — vote ===`);
  for (const player of alivePlayers(game)) {
    const view = getPlayerView(game, player.id);
    const options = view.players.filter((p) => p.alive && p.id !== player.id);

    let targetId;
    if (player.isHuman) {
      targetId = await chooseTarget(view, player.id, "Vote to eliminate", options);
    } else {
      targetId = BOTS[player.botLevel].decideVote(view, player.id);
    }
    if (targetId) game.votes[player.id] = targetId;
  }

  const winner = resolveVote(game);
  printNewPublicLog();
  return winner;
}

let lastPrintedIndex = 0;
function printNewPublicLog() {
  for (; lastPrintedIndex < game.publicLog.length; lastPrintedIndex++) {
    console.log("  " + game.publicLog[lastPrintedIndex].text);
  }
}

function printReveal(winner) {
  console.log(`\n=== GAME OVER — ${winner.toUpperCase()} WINS ===`);
  for (const p of game.players) {
    console.log(`  ${p.name}: ${p.role} (${p.alive ? "alive" : "dead"})`);
  }
}

async function main() {
  console.log("=== AI Mafia — V1 CLI ===");
  console.log(`You are: p1. Roles in play: ${Object.keys(roleCounts).concat("villager").join(", ")}`);

  while (true) {
    const nightWinner = await nightPhase();
    if (nightWinner) return printReveal(nightWinner);

    await dayPhase();

    const voteWinner = await votePhase();
    if (voteWinner) return printReveal(voteWinner);
  }
}

main().finally(() => rl.close());
