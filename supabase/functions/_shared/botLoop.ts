import { chooseBotAction, type BotDecisionContext } from "../../../src/game/botStrategy.ts";
import { getHandOfPlayer, getPlayer, resolveHandToCards, toPublicGameState } from "../../../src/game/gameState.ts";
import { chooseSkipTarget, chooseSwapTarget, discardExtraCard, drawFromStackOrDeck, getLegalMoves, playCard } from "../../../src/game/rulesEngine.ts";
import type { GameState } from "../../../src/game/types.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const BOT_THINK_MIN_MS = 500;
const BOT_THINK_MAX_MS = 1200;

function botThinkDelay(): Promise<void> {
  const ms = BOT_THINK_MIN_MS + Math.random() * (BOT_THINK_MAX_MS - BOT_THINK_MIN_MS);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs bot turns to completion (until the current player is human, or the
 * game ends). Bots go through the exact same rule-engine entry points a
 * human action would — they never get privileged state mutation — and only
 * ever see their own hand + the public projection when deciding a move.
 */
export async function runBotTurnsUntilHumanOrOver(_admin: SupabaseClient, initialState: GameState): Promise<GameState> {
  let state = initialState;
  let guard = 0;

  while (guard < 500) {
    guard += 1;
    if (state.phase === "GAME_OVER") break;

    const currentPlayer = getPlayer(state, state.currentPlayerId);
    if (currentPlayer.type !== "BOT") break;

    await botThinkDelay();

    if (state.phase === "WAITING_FOR_SWAP_TARGET") {
      const target = pickHighestCardCountOther(state, currentPlayer.playerId);
      state = chooseSwapTarget(state, currentPlayer.playerId, target);
      continue;
    }

    if (state.phase === "WAITING_FOR_SKIP_TARGET") {
      const target = pickHighestCardCountOther(state, currentPlayer.playerId);
      state = chooseSkipTarget(state, currentPlayer.playerId, target);
      continue;
    }

    if (state.phase === "WAITING_FOR_EXTRA_DISCARD") {
      const hand = getHandOfPlayer(state, currentPlayer.playerId);
      const cards = resolveHandToCards(state, hand);
      const worst = pickLeastUsefulCard(hand.cardInstanceIds, cards);
      state = discardExtraCard(state, currentPlayer.playerId, worst);
      continue;
    }

    const hand = getHandOfPlayer(state, currentPlayer.playerId);
    const cards = resolveHandToCards(state, hand);
    const legal = getLegalMoves(state, currentPlayer.playerId);
    const context: BotDecisionContext = {
      ownHand: hand.cardInstanceIds.map((instanceId, i) => ({ instanceId, def: cards[i] })),
      legalInstanceIds: legal,
      publicState: toPublicGameState(state),
    };

    const action = chooseBotAction(context, currentPlayer.botStrategyLevel ?? "NORMAL");

    if (action.type === "DRAW") {
      state = drawFromStackOrDeck(state, currentPlayer.playerId);
    } else {
      const result = playCard(state, currentPlayer.playerId, action.instanceId, { chosenColor: action.chosenColor });
      state = result.state;
    }
  }

  return state;
}

function pickHighestCardCountOther(state: GameState, botPlayerId: string): string {
  const candidates = state.players.filter((p) => !p.eliminated && p.playerId !== botPlayerId);
  const byCardCount = candidates
    .map((p) => ({ playerId: p.playerId, count: state.hands[p.currentHandId].cardInstanceIds.length }))
    .sort((a, b) => b.count - a.count);
  return byCardCount[0].playerId;
}

function pickLeastUsefulCard(instanceIds: string[], cards: { type: string }[]): string {
  // Simple heuristic: give away a plain symbol card over an action card when possible.
  const plainIndex = cards.findIndex((c) => ["TRIANGLE", "SQUARE", "CIRCLE", "DIAMOND", "SEMICIRCLE"].includes(c.type));
  return instanceIds[plainIndex !== -1 ? plainIndex : 0];
}
