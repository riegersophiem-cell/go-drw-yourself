import { describe, expect, it } from "vitest";
import { beginPendingAction, completePendingAction, isSameLogicalAction } from "../src/multiplayer/pendingAction";

describe("pending action identity", () => {
  const play = { type: "PLAY_CARD", cardInstanceId: "card-1" } as const;

  it("reuses the actionId only for an explicit retry of the same logical action", () => {
    let nextId = 0;
    const createId = () => `action-${++nextId}`;
    const first = beginPendingAction(null, play, false, createId);
    const retry = beginPendingAction(first, { cardInstanceId: "card-1", type: "PLAY_CARD" }, true, createId);

    expect(retry.actionId).toBe(first.actionId);
    expect(nextId).toBe(1);
  });

  it("creates a new actionId after success or deliberate cancellation", () => {
    let nextId = 0;
    const createId = () => `action-${++nextId}`;
    const first = beginPendingAction(null, play, false, createId);
    const completed = completePendingAction(first, first.actionId);
    const afterSuccess = beginPendingAction(completed, play, false, createId);
    const afterCancel = beginPendingAction(null, play, false, createId);

    expect(afterSuccess.actionId).not.toBe(first.actionId);
    expect(afterCancel.actionId).not.toBe(afterSuccess.actionId);
  });

  it("does not reuse an actionId for a different action even when retry is requested", () => {
    let nextId = 0;
    const createId = () => `action-${++nextId}`;
    const first = beginPendingAction(null, play, false, createId);
    const different = beginPendingAction(first, { type: "DRAW_CARD" } as const, true, createId);

    expect(different.actionId).not.toBe(first.actionId);
  });

  it("keeps the original version context with the pending request", () => {
    const request = { action: play, expectedGameId: "game-a", expectedVersion: 7 };
    const first = beginPendingAction(null, request, false, () => "action-1");
    const retry = beginPendingAction(first, first.action, true, () => "action-2");

    expect(retry).toEqual(first);
    expect(retry.action.expectedGameId).toBe("game-a");
    expect(retry.action.expectedVersion).toBe(7);
  });

  it("compares action payloads independently of property order", () => {
    expect(isSameLogicalAction(play, { cardInstanceId: "card-1", type: "PLAY_CARD" })).toBe(true);
    expect(isSameLogicalAction(play, { type: "PLAY_CARD", cardInstanceId: "card-2" })).toBe(false);
  });
});
