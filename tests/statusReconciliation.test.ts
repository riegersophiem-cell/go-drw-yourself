import { describe, expect, it } from "vitest";
import { shouldApplyStatusReconciliation } from "../src/multiplayer/statusReconciliation";

function params(overrides: Partial<Parameters<typeof shouldApplyStatusReconciliation>[0]> = {}) {
  return {
    versionAtRequestStart: 0,
    currentVersion: 0,
    requestRoomId: "room-1",
    currentRoomId: "room-1",
    cancelled: false,
    ...overrides,
  };
}

describe("shouldApplyStatusReconciliation", () => {
  it("applies when nothing changed since the read started", () => {
    expect(shouldApplyStatusReconciliation(params())).toBe(true);
  });

  it("rejects when a realtime update (or anything else) bumped the version while the read was in flight", () => {
    expect(shouldApplyStatusReconciliation(params({ versionAtRequestStart: 0, currentVersion: 1 }))).toBe(false);
  });

  it("rejects a version that is somehow ahead of current (defensive — should never happen, but must not apply)", () => {
    expect(shouldApplyStatusReconciliation(params({ versionAtRequestStart: 2, currentVersion: 1 }))).toBe(false);
  });

  it("rejects when the room changed underneath the pending read", () => {
    expect(shouldApplyStatusReconciliation(params({ requestRoomId: "room-1", currentRoomId: "room-2" }))).toBe(false);
  });

  it("rejects when currentRoomId is undefined (component unmounted/no room)", () => {
    expect(shouldApplyStatusReconciliation(params({ currentRoomId: undefined }))).toBe(false);
  });

  it("rejects when the owning effect was already cancelled, even if version and room still match", () => {
    expect(shouldApplyStatusReconciliation(params({ cancelled: true }))).toBe(false);
  });

  it("does not assume any ordinal severity between statuses — a matching version is sufficient even conceptually 'after' FINISHED", () => {
    // The function itself is status-agnostic; this documents that no
    // LOBBY < PLAYING < FINISHED comparison is involved anywhere here.
    expect(shouldApplyStatusReconciliation(params({ versionAtRequestStart: 5, currentVersion: 5 }))).toBe(true);
  });
});
