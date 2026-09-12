import { GameError } from "./errors.ts";
import { chooseColor, chooseSkipTarget, chooseSwapTarget, discardExtraCard, drawFromStackOrDeck, playCard } from "./rulesEngine.ts";
import { DEFAULT_RULESET, type CardColor, type GameState, type RulesetConfig } from "./types.ts";

export type GameAction =
  | { type: "PLAY_CARD"; cardInstanceId: string; chosenColor?: CardColor; expectedVersion?: number }
  | { type: "DRAW_CARD"; expectedVersion?: number }
  | { type: "CHOOSE_COLOR"; color: CardColor; expectedVersion?: number }
  | { type: "CHOOSE_SWAP_TARGET"; targetPlayerId: string; expectedVersion?: number }
  | { type: "CHOOSE_SKIP_TARGET"; targetPlayerId: string; expectedVersion?: number }
  | { type: "DISCARD_EXTRA_CARD"; cardInstanceId: string; expectedVersion?: number };

/**
 * Single entry point every client action funnels through (locally in tests
 * today; behind a Supabase RPC/edge function once wired up). Validates
 * staleness before delegating to the rule engine so a client racing an
 * outdated version is rejected rather than silently corrupting state.
 */
export function dispatchGameAction(
  state: GameState,
  actorPlayerId: string,
  action: GameAction,
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): GameState {
  if (action.expectedVersion !== undefined && action.expectedVersion !== state.version) {
    throw new GameError("STALE_GAME_STATE");
  }

  switch (action.type) {
    case "PLAY_CARD": {
      const result = playCard(state, actorPlayerId, action.cardInstanceId, { chosenColor: action.chosenColor }, ruleset, rng);
      return result.state;
    }
    case "DRAW_CARD":
      return drawFromStackOrDeck(state, actorPlayerId, ruleset, rng);
    case "CHOOSE_COLOR":
      return chooseColor(state, actorPlayerId, action.color, ruleset, rng);
    case "CHOOSE_SWAP_TARGET":
      return chooseSwapTarget(state, actorPlayerId, action.targetPlayerId, ruleset, rng);
    case "CHOOSE_SKIP_TARGET":
      return chooseSkipTarget(state, actorPlayerId, action.targetPlayerId, ruleset, rng);
    case "DISCARD_EXTRA_CARD":
      return discardExtraCard(state, actorPlayerId, action.cardInstanceId, ruleset, rng);
    default:
      throw new Error(`Unhandled action type: ${(action as { type: string }).type}`);
  }
}
