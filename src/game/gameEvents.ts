import type { CardColor, CardType } from "./types";

export type GameEventType =
  | "DRAW"
  | "PLAY_CARD"
  | "CHOSE_COLOR"
  | "CHOSE_SWAP_TARGET"
  | "CHOSE_SKIP_TARGET"
  | "DISCARDED_EXTRA"
  | "HANDS_ROTATED"
  | "HANDS_SWAPPED"
  | "DRAW_STACK_INCREASED"
  | "DRAW_STACK_RESOLVED"
  | "PLAYER_ELIMINATED"
  | "GAME_OVER";

export interface EventPayloadByType {
  DRAW: { playerId: string; count: number };
  PLAY_CARD: { playerId: string; color: CardColor; cardType: CardType };
  CHOSE_COLOR: { playerId: string; color: Exclude<CardColor, "WILD"> };
  CHOSE_SWAP_TARGET: { playerId: string; targetPlayerId: string };
  CHOSE_SKIP_TARGET: { playerId: string; targetPlayerId: string };
  DISCARDED_EXTRA: { playerId: string; color: CardColor; cardType: CardType };
  HANDS_ROTATED: Record<string, never>;
  HANDS_SWAPPED: { playerAId: string; playerBId: string };
  DRAW_STACK_INCREASED: { playerId: string; addedAmount: number; totalAmount: number };
  DRAW_STACK_RESOLVED: { playerId: string; amount: number };
  PLAYER_ELIMINATED: { playerId: string };
  GAME_OVER: { winnerPlayerId: string };
}

export type PendingGameEvent<T extends GameEventType = GameEventType> = T extends GameEventType
  ? { sequence: number; actorPlayerId: string | null; type: T; payload: EventPayloadByType[T]; resultVersion: number }
  : never;

export interface GameEventBatch {
  batchId: string;
  roomId: string;
  gameId: string;
  fromVersion: number;
  toVersion: number;
  events: PendingGameEvent[];
}

const COLORS = new Set<CardColor>(["RED", "BLUE", "GREEN", "YELLOW", "WILD"]);
const CARD_TYPES = new Set<CardType>([
  "TRIANGLE", "SQUARE", "CIRCLE", "DIAMOND", "SEMICIRCLE", "ROTATE_HANDS", "TARGET_SKIP",
  "GIVE_TWO_TO_LOWEST", "DISCARD_ONE_EXTRA", "SWAP_HAND", "SKIP", "REVERSE", "DRAW_1", "DRAW_2",
  "WILD", "WILD_DRAW_4", "WILD_DRAW_6", "WILD_DRAW_10", "SKIP_EVERYONE", "DISCARD_ALL",
  "WILD_REVERSE_DRAW_4", "WILD_COLOR_ROULETTE",
]);

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_EVENT_PAYLOAD");
  return value as Record<string, unknown>;
}
function stringField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`INVALID_EVENT_PAYLOAD:${key}`);
  return value;
}
function integerField(payload: Record<string, unknown>, key: string, minimum: number): number {
  const value = payload[key];
  if (!Number.isInteger(value) || (value as number) < minimum) throw new Error(`INVALID_EVENT_PAYLOAD:${key}`);
  return value as number;
}
function colorField(payload: Record<string, unknown>, key: string, allowWild = true): CardColor {
  const value = stringField(payload, key) as CardColor;
  if (!COLORS.has(value) || (!allowWild && value === "WILD")) throw new Error(`INVALID_EVENT_PAYLOAD:${key}`);
  return value;
}
function cardTypeField(payload: Record<string, unknown>, key: string): CardType {
  const value = stringField(payload, key) as CardType;
  if (!CARD_TYPES.has(value)) throw new Error(`INVALID_EVENT_PAYLOAD:${key}`);
  return value;
}

/** Returns a newly allocated, whitelisted payload. Unknown keys are never copied. */
export function sanitizeEventPayload<T extends GameEventType>(type: T, raw: unknown): EventPayloadByType[T] {
  const p = objectPayload(raw);
  let result: EventPayloadByType[GameEventType];
  switch (type) {
    case "DRAW": result = { playerId: stringField(p, "playerId"), count: integerField(p, "count", 0) }; break;
    case "PLAY_CARD": result = { playerId: stringField(p, "playerId"), color: colorField(p, "color"), cardType: cardTypeField(p, "cardType") }; break;
    case "CHOSE_COLOR": result = { playerId: stringField(p, "playerId"), color: colorField(p, "color", false) as Exclude<CardColor, "WILD"> }; break;
    case "CHOSE_SWAP_TARGET":
    case "CHOSE_SKIP_TARGET": result = { playerId: stringField(p, "playerId"), targetPlayerId: stringField(p, "targetPlayerId") }; break;
    case "DISCARDED_EXTRA": result = { playerId: stringField(p, "playerId"), color: colorField(p, "color"), cardType: cardTypeField(p, "cardType") }; break;
    case "HANDS_ROTATED": result = {}; break;
    case "HANDS_SWAPPED": result = { playerAId: stringField(p, "playerAId"), playerBId: stringField(p, "playerBId") }; break;
    case "DRAW_STACK_INCREASED": result = { playerId: stringField(p, "playerId"), addedAmount: integerField(p, "addedAmount", 1), totalAmount: integerField(p, "totalAmount", 1) }; break;
    case "DRAW_STACK_RESOLVED": result = { playerId: stringField(p, "playerId"), amount: integerField(p, "amount", 1) }; break;
    case "PLAYER_ELIMINATED": result = { playerId: stringField(p, "playerId") }; break;
    case "GAME_OVER": result = { winnerPlayerId: stringField(p, "winnerPlayerId") }; break;
    default: throw new Error("UNKNOWN_EVENT_TYPE");
  }
  return result as EventPayloadByType[T];
}
