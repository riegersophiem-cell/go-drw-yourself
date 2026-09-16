import type { CardColor, CardType } from "../game/types";
import type { GameEventBatch, PendingGameEvent } from "../game/gameEvents";

export type PlaybackBeatKind = "PLAY" | "DRAW" | "COLOR" | "SWAP" | "ROTATE" | "SKIP" | "STACK" | "EXTRA" | "ELIMINATED" | "GAME_OVER";

export interface PlaybackBeat {
  id: string;
  kind: PlaybackBeatKind;
  actorPlayerId: string | null;
  targetPlayerId?: string;
  card?: { color: CardColor; type: CardType };
  chosenColor?: Exclude<CardColor, "WILD">;
  count?: number;
  totalAmount?: number;
  eliminationReason?: "RULE" | "LEFT" | "REMOVED";
  durationMs: number;
  resultVersion: number;
  /** Index into the batch's own `events` array of the last raw event this beat represents — lets playback look up the board snapshot as of this beat (see presentationState.ts). */
  lastEventSequence: number;
}

// SWAP/ROTATE are Major Action Focus beats (see actionSeverity.ts) — their
// base duration is intentionally long (Major Actions may run up to ~5s per
// the UI brief, still subject to pacedDuration()'s chain-speedup/reduced-
// motion adjustments on top of this).
const DURATION: Record<PlaybackBeatKind, number> = {
  PLAY: 1150, DRAW: 850, COLOR: 700, SWAP: 3600, ROTATE: 3200,
  SKIP: 750, STACK: 850, EXTRA: 800, ELIMINATED: 1150, GAME_OVER: 1600,
};

/** Chaos types whose PLAY beat (before/without a further dedicated kind) is itself a Major Action Focus moment. */
const MAJOR_PLAY_TYPES: CardType[] = ["SKIP_EVERYONE", "WILD_DRAW_10", "WILD_COLOR_ROULETTE", "WILD_REVERSE_DRAW_4"];

function make(batch: GameEventBatch, event: PendingGameEvent, kind: PlaybackBeatKind, extra: Partial<PlaybackBeat> = {}): PlaybackBeat {
  return { id: `${batch.batchId}:${event.sequence}`, kind, actorPlayerId: event.actorPlayerId, durationMs: DURATION[kind], resultVersion: event.resultVersion, lastEventSequence: event.sequence, ...extra };
}

/** Groups low-level events into human-readable visual beats without consulting final state. */
export function buildPlaybackBeats(batch: GameEventBatch): PlaybackBeat[] {
  const beats: PlaybackBeat[] = [];
  for (const event of batch.events) {
    const previous = beats.at(-1);
    switch (event.type) {
      case "PLAY_CARD": {
        const isMajor = MAJOR_PLAY_TYPES.includes(event.payload.cardType);
        beats.push(make(batch, event, "PLAY", { card: { color: event.payload.color, type: event.payload.cardType }, ...(isMajor ? { durationMs: 3400 } : {}) }));
        break;
      }
      case "CHOSE_COLOR":
        if (previous?.kind === "PLAY" && previous.actorPlayerId === event.payload.playerId && previous.resultVersion === event.resultVersion) {
          previous.chosenColor = event.payload.color;
          previous.lastEventSequence = event.sequence;
        } else beats.push(make(batch, event, "COLOR", { chosenColor: event.payload.color }));
        break;
      case "DRAW": {
        const count = event.payload.count;
        beats.push(make(batch, event, "DRAW", { count, durationMs: Math.min(1350, DURATION.DRAW + Math.max(0, count - 1) * 100) }));
        break;
      }
      case "DRAW_STACK_RESOLVED":
        beats.push(make(batch, event, "DRAW", { count: event.payload.amount, totalAmount: event.payload.amount, durationMs: 1100 }));
        break;
      case "DRAW_STACK_INCREASED":
        if (previous?.kind === "PLAY" && previous.actorPlayerId === event.payload.playerId && previous.resultVersion === event.resultVersion) {
          previous.count = event.payload.addedAmount;
          previous.totalAmount = event.payload.totalAmount;
          previous.durationMs = Math.max(previous.durationMs, DURATION.STACK);
          previous.lastEventSequence = event.sequence;
        } else beats.push(make(batch, event, "STACK", { count: event.payload.addedAmount, totalAmount: event.payload.totalAmount }));
        break;
      case "CHOSE_SWAP_TARGET":
        beats.push(make(batch, event, "SWAP", { targetPlayerId: event.payload.targetPlayerId }));
        break;
      case "HANDS_SWAPPED":
        if (previous?.kind === "SWAP" && previous.actorPlayerId === event.payload.playerAId) {
          previous.targetPlayerId = event.payload.playerBId;
          previous.lastEventSequence = event.sequence;
        } else beats.push(make(batch, event, "SWAP", { actorPlayerId: event.payload.playerAId, targetPlayerId: event.payload.playerBId }));
        break;
      case "HANDS_ROTATED":
        if (previous?.kind === "PLAY" && previous.actorPlayerId === event.actorPlayerId && previous.resultVersion === event.resultVersion) {
          previous.kind = "ROTATE";
          previous.durationMs = DURATION.ROTATE;
          previous.lastEventSequence = event.sequence;
        } else beats.push(make(batch, event, "ROTATE"));
        break;
      case "CHOSE_SKIP_TARGET":
        beats.push(make(batch, event, "SKIP", { targetPlayerId: event.payload.targetPlayerId }));
        break;
      case "DISCARDED_EXTRA":
        beats.push(make(batch, event, "EXTRA", { card: { color: event.payload.color, type: event.payload.cardType } }));
        break;
      case "PLAYER_ELIMINATED":
        beats.push(make(batch, event, "ELIMINATED", { actorPlayerId: event.payload.playerId, eliminationReason: event.payload.reason }));
        break;
      case "GAME_OVER":
        beats.push(make(batch, event, "GAME_OVER", { actorPlayerId: event.payload.winnerPlayerId }));
        break;
    }
  }
  return beats;
}

const COLOR_LABEL: Record<CardColor, string> = { RED: "Rot", BLUE: "Blau", GREEN: "Grün", YELLOW: "Gelb", VIOLET: "Violett", WILD: "WILD" };
const CARD_LABEL: Record<CardType, string> = {
  TRIANGLE: "PASS", SQUARE: "LINK", CIRCLE: "PULSE", DIAMOND: "SHOVE", SEMICIRCLE: "ARC",
  ROTATE_HANDS: "ROTATE", TARGET_SKIP: "TARGET", GIVE_TWO_TO_LOWEST: "LOWEST", DISCARD_ONE_EXTRA: "DITCH",
  SWAP_HAND: "SWAP", SKIP: "SKIP", REVERSE: "REVERSE", DRAW_1: "DRAW 1", DRAW_2: "DRAW 2", DRAW_4: "DRAW 4", WILD: "WILD",
  WILD_DRAW_4: "WILD DRAW 4", WILD_DRAW_6: "WILD DRAW 6", WILD_DRAW_10: "WILD DRAW 10", SKIP_EVERYONE: "SKIP ALL",
  DISCARD_ALL: "DROP ALL", WILD_REVERSE_DRAW_4: "REVERSE +4", WILD_COLOR_ROULETTE: "COLOR ROULETTE",
};

export function playbackBeatText(beat: PlaybackBeat, playerName: (id: string | null | undefined) => string): string {
  const actor = playerName(beat.actorPlayerId);
  const target = playerName(beat.targetPlayerId);
  const card = beat.card ? `${COLOR_LABEL[beat.card.color]} · ${CARD_LABEL[beat.card.type]}` : "eine Karte";
  switch (beat.kind) {
    case "PLAY": {
      const choice = beat.chosenColor ? ` und wählt ${COLOR_LABEL[beat.chosenColor]}` : "";
      const stack = beat.totalAmount ? ` Der Stapel steht bei +${beat.totalAmount}.` : "";
      return `${actor} spielt ${card}${choice}.${stack}`;
    }
    case "DRAW": return beat.totalAmount ? `${actor} nimmt den +${beat.totalAmount}-Stapel.` : `${actor} zieht ${beat.count ?? 1} ${beat.count === 1 ? "Karte" : "Karten"}.`;
    case "COLOR": return `${actor} wählt ${beat.chosenColor ? COLOR_LABEL[beat.chosenColor] : "eine Farbe"}.`;
    case "SWAP": return `${actor} tauscht die Hand mit ${target}.`;
    case "ROTATE": return beat.card ? `${actor} spielt ${card} und rotiert alle Hände.` : `${actor} rotiert alle Hände.`;
    case "SKIP": return `${actor} setzt ${target} aus.`;
    case "STACK": return `${actor} stapelt +${beat.count ?? 0}. Gesamt: +${beat.totalAmount ?? 0}.`;
    case "EXTRA": return `${actor} wirft zusätzlich ${card} ab.`;
    case "ELIMINATED": return beat.eliminationReason === "LEFT" ? `${actor} hat das Spiel aufgegeben.` : beat.eliminationReason === "REMOVED" ? `${actor} wurde aus dem Spiel entfernt.` : `${actor} ist ausgeschieden.`;
    case "GAME_OVER": return `${actor} gewinnt die Runde.`;
  }
}
