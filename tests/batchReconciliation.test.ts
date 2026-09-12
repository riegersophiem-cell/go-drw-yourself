import { describe, expect, it } from "vitest";
import { decideBatchAcceptance, reconcileBroadcastPayload, validateBatchShape } from "../src/multiplayer/batchReconciliation";
import type { GameEventBatch } from "../src/game/gameEvents";

function batch(overrides: Partial<GameEventBatch> = {}): GameEventBatch {
  return {
    batchId: "batch-1",
    roomId: "room-1",
    gameId: "game-a",
    fromVersion: 1,
    toVersion: 2,
    events: [],
    ...overrides,
  };
}

describe("validateBatchShape", () => {
  it("accepts a well-formed batch with a contiguous, zero-based sequence", () => {
    const b = batch({ events: [{ sequence: 0 } as never, { sequence: 1 } as never] });
    expect(validateBatchShape(b)).toBe(true);
  });

  it("accepts an empty-events structural batch (e.g. 0->1 with no immediate bot moves)", () => {
    expect(validateBatchShape(batch({ fromVersion: 0, toVersion: 1, events: [] }))).toBe(true);
  });

  it("rejects a sequence with a gap or negative start, e.g. [-1, 1]", () => {
    const b = batch({ events: [{ sequence: -1 } as never, { sequence: 1 } as never] });
    expect(validateBatchShape(b)).toBe(false);
  });

  it("rejects a duplicate sequence value", () => {
    const b = batch({ events: [{ sequence: 0 } as never, { sequence: 0 } as never] });
    expect(validateBatchShape(b)).toBe(false);
  });

  it("rejects toVersion below fromVersion", () => {
    expect(validateBatchShape(batch({ fromVersion: 5, toVersion: 4 }))).toBe(false);
  });

  it("rejects a missing gameId/batchId or non-array events", () => {
    expect(validateBatchShape({ ...batch(), gameId: undefined })).toBe(false);
    expect(validateBatchShape({ ...batch(), batchId: "" })).toBe(false);
    expect(validateBatchShape({ ...batch(), events: "not-an-array" })).toBe(false);
    expect(validateBatchShape(null)).toBe(false);
    expect(validateBatchShape(42)).toBe(false);
  });
});

describe("decideBatchAcceptance", () => {
  it("accepts an exactly matching refetch as a new round when nothing was known yet (reconnect with empty queue)", () => {
    const decision = decideBatchAcceptance({
      batch: batch({ fromVersion: 0, toVersion: 1 }),
      refetchedGameId: "game-a",
      refetchedVersion: 1,
      lastKnown: null,
    });
    expect(decision).toEqual({ kind: "accept", resetQueue: true });
  });

  it("accepts a batch that extends exactly from the last known version in the same round", () => {
    const decision = decideBatchAcceptance({
      batch: batch({ fromVersion: 1, toVersion: 2 }),
      refetchedGameId: "game-a",
      refetchedVersion: 2,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(decision).toEqual({ kind: "accept", resetQueue: false });
  });

  it("treats a new gameId with the same numeric version as a new round, not a same-round duplicate", () => {
    const decision = decideBatchAcceptance({
      batch: batch({ gameId: "game-b", fromVersion: 0, toVersion: 1 }),
      refetchedGameId: "game-b",
      refetchedVersion: 1,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(decision).toEqual({ kind: "accept", resetQueue: true });
  });

  it("discards an identical batch delivered twice (duplicate broadcast)", () => {
    const lastKnown = { gameId: "game-a", version: 2 };
    const decision = decideBatchAcceptance({
      batch: batch({ fromVersion: 1, toVersion: 2 }),
      refetchedGameId: "game-a",
      refetchedVersion: 2,
      lastKnown,
    });
    expect(decision).toEqual({ kind: "discard", reason: "DUPLICATE_OR_OLD" });
  });

  it("discards two batches delivered out of order (swapped), never displaying either out of sequence", () => {
    // Second batch (2->3) arrives first; refetch already shows the final committed version 3.
    const swapped = decideBatchAcceptance({
      batch: batch({ fromVersion: 2, toVersion: 3 }),
      refetchedGameId: "game-a",
      refetchedVersion: 3,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(swapped).toEqual({ kind: "discard", reason: "VERSION_GAP" });

    // First batch (1->2) arrives after; refetch is already ahead of it.
    const superseded = decideBatchAcceptance({
      batch: batch({ fromVersion: 1, toVersion: 2 }),
      refetchedGameId: "game-a",
      refetchedVersion: 3,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(superseded).toEqual({ kind: "discard", reason: "SUPERSEDED" });
  });

  it("discards a batch with a version gap (e.g. 0,1,3 style hole between accepted batches)", () => {
    const decision = decideBatchAcceptance({
      batch: batch({ fromVersion: 3, toVersion: 4 }),
      refetchedGameId: "game-a",
      refetchedVersion: 4,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(decision).toEqual({ kind: "discard", reason: "VERSION_GAP" });
  });

  it("discards an echo from a gameId two rounds old, even though the refetch itself always wins", () => {
    // Client's own bookkeeping still thinks round B is current; a stale
    // broadcast from round A (already two rounds behind the real, freshly
    // refetched round C) must never be treated as belonging to C.
    const decision = decideBatchAcceptance({
      batch: batch({ gameId: "game-a", fromVersion: 5, toVersion: 6 }),
      refetchedGameId: "game-c",
      refetchedVersion: 2,
      lastKnown: { gameId: "game-b", version: 9 },
    });
    expect(decision).toEqual({ kind: "discard", reason: "STALE_ROUND_ECHO" });
  });

  it("discards when the refetch is already ahead of the batch's own toVersion", () => {
    const decision = decideBatchAcceptance({
      batch: batch({ fromVersion: 1, toVersion: 2 }),
      refetchedGameId: "game-a",
      refetchedVersion: 5,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(decision).toEqual({ kind: "discard", reason: "SUPERSEDED" });
  });

  it("discards (for now) when the refetch is still behind the batch's own toVersion", () => {
    const decision = decideBatchAcceptance({
      batch: batch({ fromVersion: 1, toVersion: 3 }),
      refetchedGameId: "game-a",
      refetchedVersion: 2,
      lastKnown: { gameId: "game-a", version: 1 },
    });
    expect(decision).toEqual({ kind: "discard", reason: "REFETCH_BEHIND_BATCH" });
  });

  it("accepts and resets the queue for a fresh reload/reconnect that then receives a matching batch", () => {
    // Simulates: page reload wipes all client state (lastKnown = null), the
    // very next legitimate batch for the room's current round must still be
    // accepted normally, not treated as a leftover from before the reload.
    const decision = decideBatchAcceptance({
      batch: batch({ gameId: "game-z", fromVersion: 4, toVersion: 5 }),
      refetchedGameId: "game-z",
      refetchedVersion: 5,
      lastKnown: null,
    });
    expect(decision).toEqual({ kind: "accept", resetQueue: true });
  });
});

describe("reconcileBroadcastPayload", () => {
  it("always refetches authoritative state even when the broadcast payload is malformed", async () => {
    let refetchCount = 0;
    const result = await reconcileBroadcastPayload({
      payload: { version: 7 },
      lastKnown: { gameId: "game-a", version: 6 },
      refetchAuthoritative: async () => {
        refetchCount += 1;
        return { gameId: "game-a", version: 7 };
      },
    });

    expect(refetchCount).toBe(1);
    expect(result).toEqual({ kind: "invalid_payload" });
  });

  it("returns a valid batch decision after the authoritative refetch", async () => {
    const value = batch({ fromVersion: 6, toVersion: 7 });
    const result = await reconcileBroadcastPayload({
      payload: value,
      lastKnown: { gameId: "game-a", version: 6 },
      refetchAuthoritative: async () => ({ gameId: "game-a", version: 7 }),
    });

    expect(result).toEqual({ kind: "batch", batch: value, decision: { kind: "accept", resetQueue: false } });
  });
});
