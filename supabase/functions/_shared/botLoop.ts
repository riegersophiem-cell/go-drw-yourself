import { chooseBotAction, type BotAction, type BotDecisionContext, type BotStrategyLevel } from "../../../src/game/botStrategy.ts";
import { deriveGameActionEvents, sequenceEvents } from "../../../src/game/gameEventDerivation.ts";
import type { PendingGameEvent } from "../../../src/game/gameEvents.ts";
import { getHandOfPlayer, getPlayer, resolveHandToCards, toPublicGameState } from "../../../src/game/gameState.ts";
import { chooseSkipTarget, chooseSwapTarget, discardExtraCard, drawFromStackOrDeck, getLegalMoves, playCard } from "../../../src/game/rulesEngine.ts";
import type { GameState } from "../../../src/game/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

export interface BotTurnResult { state: GameState; events: PendingGameEvent[] }
export interface BotLoopOptions {
  maxSteps?: number;
  chooseAction?: (context: BotDecisionContext, level: BotStrategyLevel) => BotAction;
}

/** Computes the complete bot chain immediately. Presentation timing belongs to the client. */
export async function runBotTurnsUntilHumanOrOver(
  _admin: SupabaseClient,
  initialState: GameState,
  options: BotLoopOptions = {},
): Promise<BotTurnResult> {
  let state = initialState;
  const events: PendingGameEvent[] = [];
  const maxSteps = options.maxSteps ?? 500;
  const decide = options.chooseAction ?? chooseBotAction;
  let steps = 0;

  const append = (before: GameState, after: GameState, actor: string, action: Parameters<typeof deriveGameActionEvents>[3]) => {
    events.push(...sequenceEvents(deriveGameActionEvents(before, after, actor, action), events.length));
  };

  while (steps < maxSteps && state.phase !== "GAME_OVER") {
    const currentPlayer = getPlayer(state, state.currentPlayerId);
    if (currentPlayer.type !== "BOT") break;
    steps += 1;
    const before = state;

    if (state.phase === "WAITING_FOR_SWAP_TARGET") {
      const target = pickHighestCardCountOther(state, currentPlayer.playerId);
      state = chooseSwapTarget(state, currentPlayer.playerId, target);
      append(before, state, currentPlayer.playerId, { type: "CHOOSE_SWAP_TARGET", targetPlayerId: target });
      continue;
    }
    if (state.phase === "WAITING_FOR_SKIP_TARGET") {
      const target = pickHighestCardCountOther(state, currentPlayer.playerId);
      state = chooseSkipTarget(state, currentPlayer.playerId, target);
      append(before, state, currentPlayer.playerId, { type: "CHOOSE_SKIP_TARGET", targetPlayerId: target });
      continue;
    }
    if (state.phase === "WAITING_FOR_EXTRA_DISCARD") {
      const hand = getHandOfPlayer(state, currentPlayer.playerId);
      const cards = resolveHandToCards(state, hand);
      const cardInstanceId = pickLeastUsefulCard(hand.cardInstanceIds, cards);
      state = discardExtraCard(state, currentPlayer.playerId, cardInstanceId);
      append(before, state, currentPlayer.playerId, { type: "DISCARD_EXTRA_CARD", cardInstanceId });
      continue;
    }

    const hand = getHandOfPlayer(state, currentPlayer.playerId);
    const cards = resolveHandToCards(state, hand);
    const context: BotDecisionContext = {
      ownHand: hand.cardInstanceIds.map((instanceId, i) => ({ instanceId, def: cards[i] })),
      legalInstanceIds: getLegalMoves(state, currentPlayer.playerId),
      publicState: toPublicGameState(state),
    };
    const action = decide(context, currentPlayer.botStrategyLevel ?? "NORMAL");
    if (action.type === "DRAW") {
      state = drawFromStackOrDeck(state, currentPlayer.playerId);
      append(before, state, currentPlayer.playerId, { type: "DRAW_CARD" });
    } else {
      state = playCard(state, currentPlayer.playerId, action.instanceId, { chosenColor: action.chosenColor }).state;
      append(before, state, currentPlayer.playerId, { type: "PLAY_CARD", cardInstanceId: action.instanceId, chosenColor: action.chosenColor });
    }
  }

  if (steps >= maxSteps && state.phase !== "GAME_OVER" && getPlayer(state, state.currentPlayerId).type === "BOT") {
    throw new Error("BOT_TURN_GUARD_EXCEEDED");
  }
  return { state, events };
}

function pickHighestCardCountOther(state: GameState, botPlayerId: string): string {
  const candidates = state.players.filter((p) => !p.eliminated && p.playerId !== botPlayerId)
    .map((p) => ({ playerId: p.playerId, count: state.hands[p.currentHandId].cardInstanceIds.length }))
    .sort((a, b) => b.count - a.count);
  if (!candidates[0]) throw new Error("BOT_TARGET_NOT_FOUND");
  return candidates[0].playerId;
}

function pickLeastUsefulCard(instanceIds: string[], cards: { type: string }[]): string {
  const plainIndex = cards.findIndex((c) => ["TRIANGLE", "SQUARE", "CIRCLE", "DIAMOND", "SEMICIRCLE"].includes(c.type));
  const result = instanceIds[plainIndex !== -1 ? plainIndex : 0];
  if (!result) throw new Error("BOT_DISCARD_NOT_FOUND");
  return result;
}
