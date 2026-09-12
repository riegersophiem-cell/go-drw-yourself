import { definitionOfInstance, toPublicGameState } from "./gameState.ts";
import { getLegalMoves } from "./rulesEngine.ts";
import { DEFAULT_RULESET, type GameState, type PrivatePlayerState, type RulesetConfig } from "./types.ts";

/**
 * Builds the view a single player's device is allowed to receive. This is
 * the ONLY function that should ever cross the server/client boundary with
 * hand data — it must never be given another player's id by mistake.
 */
export function buildPrivatePlayerState(
  state: GameState,
  playerId: string,
  ruleset: RulesetConfig = DEFAULT_RULESET,
): PrivatePlayerState {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  const hand = state.hands[player.currentHandId];

  return {
    playerId,
    ownHand: hand.cardInstanceIds.map((instanceId) => ({ instanceId, def: definitionOfInstance(state, instanceId) })),
    // Legal moves only make sense while the player can actually play or draw —
    // during a follow-up phase (color/swap/skip target, extra discard) the
    // previous move's legality no longer applies to anything.
    legalMoves: state.currentPlayerId === playerId && state.phase === "WAITING_FOR_PLAY" ? getLegalMoves(state, playerId, ruleset) : [],
    publicState: toPublicGameState(state),
  };
}
