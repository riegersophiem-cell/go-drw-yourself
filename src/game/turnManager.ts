import type { GameState, Player } from "./types.ts";

/** Active (non-eliminated) players in seat order. */
export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.eliminated);
}

/**
 * Computes the next player's id, walking `steps` seats in the current
 * direction and skipping eliminated players. `steps=1` is a normal advance;
 * Skip/SkipEveryone effects pass a larger value.
 */
export function getNextPlayerId(state: GameState, fromPlayerId: string, steps = 1): string {
  const order = state.players; // full seat order, includes eliminated for stable indexing
  const total = order.length;
  let idx = order.findIndex((p) => p.playerId === fromPlayerId);
  if (idx === -1) throw new Error(`Player ${fromPlayerId} not found in seat order`);

  let remaining = steps;
  while (remaining > 0) {
    idx = (idx + state.direction + total) % total;
    if (!order[idx].eliminated) remaining -= 1;
  }
  return order[idx].playerId;
}

/**
 * Resolves who becomes the current player after advancing `steps` seats,
 * consuming any pending TARGET_SKIP marks along the way (a marked player is
 * skipped once and their mark is cleared, then the search continues). Marks
 * persist across other players' turns and survive reconnect since they live
 * directly on GameState, not in transient UI state.
 */
export function advanceTurnConsumingSkips(
  state: GameState,
  fromPlayerId: string,
  steps: number,
): { playerId: string; pendingSkipTargets: Record<string, number> } {
  let candidate = getNextPlayerId(state, fromPlayerId, steps);
  const pendingSkipTargets = { ...state.pendingSkipTargets };
  let guard = 0;
  while (pendingSkipTargets[candidate] && guard < 50) {
    guard += 1;
    const remaining = pendingSkipTargets[candidate] - 1;
    if (remaining <= 0) delete pendingSkipTargets[candidate];
    else pendingSkipTargets[candidate] = remaining;
    candidate = getNextPlayerId(state, candidate, 1);
  }
  return { playerId: candidate, pendingSkipTargets };
}

export function checkWin(state: GameState): string | null {
  for (const player of state.players) {
    if (!player.eliminated && state.hands[player.currentHandId].cardInstanceIds.length === 0) {
      return player.playerId;
    }
  }
  return null;
}

/**
 * Mercy Rule: TODO_VERIFY_OFFICIAL_RULE — exact elimination threshold and
 * whether it eliminates the player or ends the game outright is not
 * confirmed against the official rulebook. Implemented here as: a player
 * whose hand grows at or beyond the configured threshold is eliminated.
 */
export function checkMercyRule(state: GameState, threshold: number): string[] {
  const eliminated: string[] = [];
  for (const player of state.players) {
    if (player.eliminated) continue;
    if (state.hands[player.currentHandId].cardInstanceIds.length >= threshold) {
      eliminated.push(player.playerId);
    }
  }
  return eliminated;
}
