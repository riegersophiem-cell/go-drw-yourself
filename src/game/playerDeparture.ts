import { getNextPlayerId } from "./turnManager.ts";
import type { GameState } from "./types.ts";

/**
 * Removes a player from the active round without destroying their identity.
 * Keeping the player/hand in the state preserves the event narration and card
 * conservation, while `eliminated` makes every rule path ignore the seat.
 */
export function forfeitPlayer(state: GameState, playerId: string): GameState {
  const departing = state.players.find((player) => player.playerId === playerId);
  if (!departing || departing.eliminated) throw new Error("PLAYER_NOT_ACTIVE");

  const remaining = state.players.filter((player) => !player.eliminated && player.playerId !== playerId);
  if (remaining.length === 0) throw new Error("LAST_PLAYER_CANNOT_LEAVE");

  const wasCurrent = state.currentPlayerId === playerId;
  const players = state.players.map((player) => player.playerId === playerId
    ? { ...player, connected: false, eliminated: true }
    : player);
  const pendingSkipTargets = { ...state.pendingSkipTargets };
  delete pendingSkipTargets[playerId];

  if (remaining.length === 1) {
    return {
      ...state,
      version: state.version + 1,
      players,
      pendingSwapPlayerId: null,
      pendingSkipPlayerId: null,
      pendingExtraDiscardPlayerId: null,
      pendingSkipTargets,
      phase: "GAME_OVER",
      currentPlayerId: remaining[0].playerId,
      winnerPlayerId: remaining[0].playerId,
    };
  }

  const ownedPendingChoice = state.pendingSwapPlayerId === playerId
    || state.pendingSkipPlayerId === playerId
    || state.pendingExtraDiscardPlayerId === playerId
    || (wasCurrent && state.phase === "WAITING_FOR_COLOR");

  return {
    ...state,
    version: state.version + 1,
    players,
    currentPlayerId: wasCurrent ? getNextPlayerId({ ...state, players }, playerId, 1) : state.currentPlayerId,
    turnNumber: wasCurrent ? state.turnNumber + 1 : state.turnNumber,
    phase: ownedPendingChoice ? "WAITING_FOR_PLAY" : state.phase,
    pendingSwapPlayerId: state.pendingSwapPlayerId === playerId ? null : state.pendingSwapPlayerId,
    pendingSkipPlayerId: state.pendingSkipPlayerId === playerId ? null : state.pendingSkipPlayerId,
    pendingExtraDiscardPlayerId: state.pendingExtraDiscardPlayerId === playerId ? null : state.pendingExtraDiscardPlayerId,
    pendingSkipTargets,
  };
}
