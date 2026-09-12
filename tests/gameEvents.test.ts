import { describe, expect, it } from "vitest";
import { sanitizeEventPayload, type GameEventType } from "../src/game/gameEvents";

const valid: Record<GameEventType, Record<string, unknown>> = {
  DRAW: { playerId: "p1", count: 2 },
  PLAY_CARD: { playerId: "p1", color: "RED", cardType: "REVERSE" },
  CHOSE_COLOR: { playerId: "p1", color: "BLUE" },
  CHOSE_SWAP_TARGET: { playerId: "p1", targetPlayerId: "p2" },
  CHOSE_SKIP_TARGET: { playerId: "p1", targetPlayerId: "p2" },
  DISCARDED_EXTRA: { playerId: "p1", color: "GREEN", cardType: "CIRCLE" },
  HANDS_ROTATED: {},
  HANDS_SWAPPED: { playerAId: "p1", playerBId: "p2" },
  DRAW_STACK_INCREASED: { playerId: "p1", addedAmount: 4, totalAmount: 8 },
  DRAW_STACK_RESOLVED: { playerId: "p1", amount: 8 },
  PLAYER_ELIMINATED: { playerId: "p1" },
  GAME_OVER: { winnerPlayerId: "p1" },
};

describe("sanitizeEventPayload", () => {
  for (const [type, payload] of Object.entries(valid) as [GameEventType, Record<string, unknown>][]) {
    it(`${type} accepts its public schema and strips extra/private keys`, () => {
      const cleaned = sanitizeEventPayload(type, { ...payload, instanceId: "secret-card", hiddenHand: ["secret"] });
      expect(cleaned).toEqual(payload);
      expect(JSON.stringify(cleaned)).not.toContain("secret-card");
      expect(cleaned).not.toHaveProperty("hiddenHand");
    });
  }

  it("rejects a missing required field", () => expect(() => sanitizeEventPayload("DRAW", { playerId: "p1" })).toThrow("count"));
  it("rejects wrong primitive types", () => expect(() => sanitizeEventPayload("DRAW", { playerId: "p1", count: "2" })).toThrow("count"));
  it("rejects arrays and null as payloads", () => {
    expect(() => sanitizeEventPayload("HANDS_ROTATED", [])).toThrow("INVALID_EVENT_PAYLOAD");
    expect(() => sanitizeEventPayload("HANDS_ROTATED", null)).toThrow("INVALID_EVENT_PAYLOAD");
  });
  it("rejects WILD as a chosen color", () => expect(() => sanitizeEventPayload("CHOSE_COLOR", { playerId: "p1", color: "WILD" })).toThrow("color"));
  it("rejects unknown card values", () => expect(() => sanitizeEventPayload("PLAY_CARD", { playerId: "p1", color: "PURPLE", cardType: "NOPE" })).toThrow());
});
