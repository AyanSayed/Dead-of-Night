export function resolveNight(gameState) {
  const actions = Object.entries(gameState.nightActions); // [actorId, {action, targetId}]

  // Framer: reset frames each night, then record this night's frames before
  // any investigation resolves, so detective.resolveInvestigation sees them.
  gameState.frames = {};
  for (const [, action] of actions) {
    if (action.action === "frame") {
      gameState.frames[action.targetId] = true;
    }
  }

  const protectedIds = new Set(
    actions.filter(([, a]) => a.action === "protect").map(([, a]) => a.targetId)
  );

  const killVotes = actions.filter(([, a]) => a.action === "kill").map(([, a]) => a.targetId);
  const killTargetId = majorityTarget(killVotes);

  let killedPlayer = null;
  if (killTargetId && !protectedIds.has(killTargetId)) {
    killedPlayer = getPlayer(gameState, killTargetId);
    if (killedPlayer) killedPlayer.alive = false;
  }

  const shotPlayers = [];
  for (const [actorId, action] of actions) {
    if (action.action !== "shoot") continue;
    if (protectedIds.has(action.targetId)) continue;
    const target = getPlayer(gameState, action.targetId);
    if (target && target.alive) {
      target.alive = false;
      shotPlayers.push(target);
    }
  }

  logPublic(gameState, {
    type: "night_result",
    text: killedPlayer ? `${killedPlayer.name} was found dead.` : "No one died last night.",
    targetId: killedPlayer ? killedPlayer.id : null,
  });

  for (const shot of shotPlayers) {
    logPublic(gameState, {
      type: "night_result",
      text: `${shot.name} was shot during the night.`,
      targetId: shot.id,
    });
  }

  for (const [actorId, action] of actions) {
    if (action.action !== "investigate") continue;
    const actor = getPlayer(gameState, actorId);
    const roleDef = ROLES[actor.role];
    if (!roleDef.resolveInvestigation) continue;
    const result = roleDef.resolveInvestigation(gameState, action.targetId);
    const target = getPlayer(gameState, action.targetId);
    actor.privateLog = actor.privateLog || [];
    actor.privateLog.push({
      day: gameState.day,
      type: "investigation_result",
      targetId: target.id,
      text: `${target.name} came back: ${result}.`,
    });
  }

  gameState.nightActions = {};
  gameState.phase = "day";
  return checkWinCondition(gameState);
}