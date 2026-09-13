import type { GameAction } from "./actions.ts";
import { definitionOfInstance, getHandOfPlayer } from "./gameState.ts";
import { sanitizeEventPayload, type GameEventType, type PendingGameEvent } from "./gameEvents.ts";
import type { GameState } from "./types.ts";

type UnsequencedEvent = Omit<PendingGameEvent, "sequence">;

function event<T extends GameEventType>(type: T, actorPlayerId: string | null, payload: unknown, resultVersion: number): UnsequencedEvent {
  return { type, actorPlayerId, payload: sanitizeEventPayload(type, payload), resultVersion } as UnsequencedEvent;
}

function handCount(state: GameState, playerId: string): number {
  return getHandOfPlayer(state, playerId).cardInstanceIds.length;
}

function terminalEvents(before: GameState, after: GameState): UnsequencedEvent[] {
  const result: UnsequencedEvent[] = [];
  for (const player of after.players) {
    const wasEliminated = before.players.find((candidate) => candidate.playerId === player.playerId)?.eliminated ?? false;
    if (!wasEliminated && player.eliminated) result.push(event("PLAYER_ELIMINATED", player.playerId, { playerId: player.playerId }, after.version));
  }
  if (before.phase !== "GAME_OVER" && after.phase === "GAME_OVER" && after.winnerPlayerId) {
    result.push(event("GAME_OVER", after.winnerPlayerId, { winnerPlayerId: after.winnerPlayerId }, after.version));
  }
  return result;
}

/** Derives public narration data from one already-validated rule-engine transition. */
export function deriveGameActionEvents(before: GameState, after: GameState, actorPlayerId: string, action: GameAction): UnsequencedEvent[] {
  const result: UnsequencedEvent[] = [];
  switch (action.type) {
    case "PLAY_CARD": {
      const card = definitionOfInstance(before, action.cardInstanceId);
      result.push(event("PLAY_CARD", actorPlayerId, { playerId: actorPlayerId, color: card.color, cardType: card.type }, after.version));
      if (action.chosenColor) result.push(event("CHOSE_COLOR", actorPlayerId, { playerId: actorPlayerId, color: action.chosenColor }, after.version));
      if (card.type === "ROTATE_HANDS") result.push(event("HANDS_ROTATED", actorPlayerId, {}, after.version));
      const beforeStack = before.pendingEffect?.type === "DRAW_STACK" ? before.pendingEffect.amount : 0;
      const afterStack = after.pendingEffect?.type === "DRAW_STACK" ? after.pendingEffect.amount : 0;
      if (afterStack > beforeStack) {
        result.push(event("DRAW_STACK_INCREASED", actorPlayerId, { playerId: actorPlayerId, addedAmount: afterStack - beforeStack, totalAmount: afterStack }, after.version));
      }
      if (card.type === "GIVE_TWO_TO_LOWEST") {
        for (const player of after.players) {
          // The actor's own hand also shrank by the card they just played, so
          // a plain after-minus-before delta undercounts by 1 whenever the
          // actor themselves ends up being the lowest-hand recipient (a real,
          // reproducible case - confirmed live: hand went 3 -> 2 (play) -> 4
          // (bonus draw), a net +1, though the effect draws 2 cards).
          const rawCount = handCount(after, player.playerId) - handCount(before, player.playerId);
          const count = player.playerId === actorPlayerId ? rawCount + 1 : rawCount;
          if (count > 0) result.push(event("DRAW", player.playerId, { playerId: player.playerId, count }, after.version));
        }
      }
      break;
    }
    case "DRAW_CARD": {
      const stack = before.pendingEffect?.type === "DRAW_STACK" ? before.pendingEffect.amount : null;
      const count = Math.max(0, handCount(after, actorPlayerId) - handCount(before, actorPlayerId));
      if (stack !== null) result.push(event("DRAW_STACK_RESOLVED", actorPlayerId, { playerId: actorPlayerId, amount: stack }, after.version));
      else result.push(event("DRAW", actorPlayerId, { playerId: actorPlayerId, count }, after.version));
      break;
    }
    case "CHOOSE_COLOR":
      result.push(event("CHOSE_COLOR", actorPlayerId, { playerId: actorPlayerId, color: action.color }, after.version));
      break;
    case "CHOOSE_SWAP_TARGET":
      result.push(event("CHOSE_SWAP_TARGET", actorPlayerId, { playerId: actorPlayerId, targetPlayerId: action.targetPlayerId }, after.version));
      result.push(event("HANDS_SWAPPED", actorPlayerId, { playerAId: actorPlayerId, playerBId: action.targetPlayerId }, after.version));
      break;
    case "CHOOSE_SKIP_TARGET":
      result.push(event("CHOSE_SKIP_TARGET", actorPlayerId, { playerId: actorPlayerId, targetPlayerId: action.targetPlayerId }, after.version));
      break;
    case "DISCARD_EXTRA_CARD": {
      const card = definitionOfInstance(before, action.cardInstanceId);
      result.push(event("DISCARDED_EXTRA", actorPlayerId, { playerId: actorPlayerId, color: card.color, cardType: card.type }, after.version));
      break;
    }
  }
  return [...result, ...terminalEvents(before, after)];
}

export function sequenceEvents(events: UnsequencedEvent[], start = 0): PendingGameEvent[] {
  return events.map((item, index) => ({ ...item, sequence: start + index })) as PendingGameEvent[];
}
