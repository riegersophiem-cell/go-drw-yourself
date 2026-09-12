import type { GameState, Player } from "./types.ts";
import { activePlayers, getNextPlayerId } from "./turnManager.ts";

/**
 * Atomically swaps two players' hand ownership. Only `currentHandId`
 * pointers move — the underlying Hand objects (and their cards) are
 * untouched, so there is never a moment where a hand has zero or two owners.
 */
export function swapHands(state: GameState, playerAId: string, playerBId: string): GameState {
  const players = state.players.map((p): Player => {
    if (p.playerId === playerAId) {
      const other = state.players.find((x) => x.playerId === playerBId)!;
      return { ...p, currentHandId: other.currentHandId };
    }
    if (p.playerId === playerBId) {
      const other = state.players.find((x) => x.playerId === playerAId)!;
      return { ...p, currentHandId: other.currentHandId };
    }
    return p;
  });
  return { ...state, players };
}

/**
 * Rotates hand ownership across every active player (bots included) in the
 * current direction of play. Computed as a single pointer permutation so all
 * hands move in one atomic step — no player is ever briefly without a hand.
 */
export function rotateHandsAllPlayers(state: GameState): GameState {
  const active = activePlayers(state);
  if (active.length < 2) return state;

  const handIdByPlayer = new Map(active.map((p) => [p.playerId, p.currentHandId]));
  const players = state.players.map((p): Player => {
    if (p.eliminated) return p;
    // The player receives the hand of whoever sits "behind" them in the
    // direction of rotation, i.e. the hand travels forward with each 0 play.
    const donorId = getNextPlayerId(state, p.playerId, active.length - 1);
    const donorHandId = handIdByPlayer.get(donorId);
    return donorHandId ? { ...p, currentHandId: donorHandId } : p;
  });
  return { ...state, players };
}
