import type { GameEventBatch, PendingGameEvent } from "../game/gameEvents";
import type { PublicGameState, PublicPlayerView } from "../game/types";

/**
 * A queued batch plus the public state that was authoritative right before
 * it (whatever `publicState` held the instant the batch's broadcast arrived,
 * before the confirming refetch overwrote it with the final result) — the
 * base `buildPresentationSnapshots` replays events onto. `null` only when no
 * prior state was ever observed (practically: never reachable, since a batch
 * cannot exist without an already-loaded game).
 */
export interface PresentationBatch extends GameEventBatch {
  baseState: PublicGameState | null;
}

/**
 * Reconstructs the board as it looked immediately after each step of a bot
 * chain, purely for presentation. Root cause this exists to fix: the server
 * resolves an entire human-action-plus-bot-chain in one transaction and
 * persists only the FINAL state (see botLoop.ts's
 * `runBotTurnsUntilHumanOrOver` — "Presentation timing belongs to the
 * client"). The live `publicState` therefore already shows the last bot's
 * result the instant the batch arrives, while `useTurnPlayback` is still
 * narrating bot #1's move — the discard pile, active color and "whose turn"
 * highlight all raced ahead of the story being told. These functions replay
 * the batch's own events on top of the state that was authoritative right
 * before the batch, one event at a time, so playback can show the board as
 * of whichever beat is currently visible instead of the batch's end result.
 *
 * Never used for gameplay decisions (legality, whose turn it really is for
 * input purposes) — only for what GameTable renders while a batch plays
 * back. The live publicState remains the sole authority once playback
 * catches up to it.
 */

function withPlayer(players: PublicPlayerView[], playerId: string, update: (p: PublicPlayerView) => PublicPlayerView): PublicPlayerView[] {
  return players.map((p) => (p.playerId === playerId ? update(p) : p));
}

/** Mirrors turnManager.getNextPlayerId's walk, but over the public projection (no hands needed). */
function nextActivePlayerId(state: PublicGameState, fromPlayerId: string, steps: number): string {
  const order = state.players;
  const total = order.length;
  let idx = order.findIndex((p) => p.playerId === fromPlayerId);
  if (idx === -1) return fromPlayerId;
  let remaining = steps;
  let guard = 0;
  while (remaining > 0 && guard < total * 2 + 2) {
    idx = (idx + state.direction + total) % total;
    if (!order[idx].eliminated) remaining -= 1;
    guard += 1;
  }
  return order[idx].playerId;
}

export function applyEventToPublicState(state: PublicGameState, event: PendingGameEvent): PublicGameState {
  // Whoever this event's actor is gets the ring's "active seat" highlight for
  // the duration of the beat it belongs to — simpler and just as legible as
  // replaying the real turn-order/skip logic, and every event that matters
  // for this already carries the right actorPlayerId (the human/bot doing
  // something, not a bystander).
  const base: PublicGameState = event.actorPlayerId ? { ...state, currentPlayerId: event.actorPlayerId } : state;

  switch (event.type) {
    case "DRAW": {
      const { playerId, count } = event.payload;
      return {
        ...base,
        players: withPlayer(base.players, playerId, (p) => ({ ...p, cardCount: p.cardCount + count })),
        drawPileCount: Math.max(0, base.drawPileCount - count),
        version: event.resultVersion,
      };
    }
    case "DRAW_STACK_RESOLVED": {
      const { playerId, amount } = event.payload;
      return {
        ...base,
        players: withPlayer(base.players, playerId, (p) => ({ ...p, cardCount: p.cardCount + amount })),
        drawPileCount: Math.max(0, base.drawPileCount - amount),
        pendingEffect: null,
        version: event.resultVersion,
      };
    }
    case "PLAY_CARD": {
      const { playerId, color, cardType } = event.payload;
      return {
        ...base,
        players: withPlayer(base.players, playerId, (p) => ({ ...p, cardCount: Math.max(0, p.cardCount - 1) })),
        // defId only ever needs to be a stable-enough React key here — the
        // real, deck-unique id lives server-side and never reaches the
        // client's PublicGameState projection in the first place.
        topDiscard: { defId: `presentation_${color}_${cardType}`, color, type: cardType },
        activeColor: color === "WILD" ? base.activeColor : color,
        version: event.resultVersion,
      };
    }
    case "CHOSE_COLOR":
      return { ...base, activeColor: event.payload.color, version: event.resultVersion };
    case "DISCARDED_EXTRA": {
      // Never becomes the visible top card — see CARD_LOGIC.md's DISCARD_ONE_EXTRA note.
      const { playerId } = event.payload;
      return {
        ...base,
        players: withPlayer(base.players, playerId, (p) => ({ ...p, cardCount: Math.max(0, p.cardCount - 1) })),
        version: event.resultVersion,
      };
    }
    case "CHOSE_SKIP_TARGET": {
      const { targetPlayerId } = event.payload;
      return {
        ...base,
        pendingSkipTargets: { ...base.pendingSkipTargets, [targetPlayerId]: (base.pendingSkipTargets[targetPlayerId] ?? 0) + 1 },
        version: event.resultVersion,
      };
    }
    case "CHOSE_SWAP_TARGET":
      return { ...base, version: event.resultVersion };
    case "HANDS_SWAPPED": {
      const { playerAId, playerBId } = event.payload;
      const countA = base.players.find((p) => p.playerId === playerAId)?.cardCount ?? 0;
      const countB = base.players.find((p) => p.playerId === playerBId)?.cardCount ?? 0;
      return {
        ...base,
        players: base.players.map((p) => {
          if (p.playerId === playerAId) return { ...p, cardCount: countB };
          if (p.playerId === playerBId) return { ...p, cardCount: countA };
          return p;
        }),
        version: event.resultVersion,
      };
    }
    case "HANDS_ROTATED": {
      const activeCount = base.players.filter((p) => !p.eliminated).length;
      if (activeCount < 2) return { ...base, version: event.resultVersion };
      const countByPlayer = new Map(base.players.map((p) => [p.playerId, p.cardCount]));
      return {
        ...base,
        players: base.players.map((p) => {
          if (p.eliminated) return p;
          const donorId = nextActivePlayerId(base, p.playerId, activeCount - 1);
          return { ...p, cardCount: countByPlayer.get(donorId) ?? p.cardCount };
        }),
        version: event.resultVersion,
      };
    }
    // Reports a stack growing (e.g. a stacked DRAW_2 on top of a DRAW_4) — no
    // cards actually move until someone eventually draws or resolves it, but
    // the "+N" chip on the discard pile (DiscardStage) should track it live.
    // Only .type/.amount are ever read by a renderer (see DiscardStage.tsx);
    // `terminal` can't be reconstructed from this event alone (it doesn't
    // carry the card's type) so it's left false here — worst case a
    // presentation-only value is briefly wrong mid-chain and self-corrects
    // once the live publicState takes over at the end of playback; it is
    // never consulted for actual play legality.
    case "DRAW_STACK_INCREASED":
      return {
        ...base,
        pendingEffect: { type: "DRAW_STACK", amount: event.payload.totalAmount, lastDrawValue: event.payload.addedAmount, terminal: false, sourcePlayerId: event.actorPlayerId ?? "" },
        version: event.resultVersion,
      };
    case "PLAYER_ELIMINATED": {
      const { playerId } = event.payload;
      return { ...base, players: withPlayer(base.players, playerId, (p) => ({ ...p, eliminated: true })), version: event.resultVersion };
    }
    case "GAME_OVER":
      return { ...base, winnerPlayerId: event.payload.winnerPlayerId, version: event.resultVersion };
    default:
      return base;
  }
}

/** snapshots[i] is the board immediately after events[i]. Same length as events. */
export function buildPresentationSnapshots(base: PublicGameState, events: PendingGameEvent[]): PublicGameState[] {
  const snapshots: PublicGameState[] = [];
  let state = base;
  for (const event of events) {
    state = applyEventToPublicState(state, event);
    snapshots.push(state);
  }
  return snapshots;
}
