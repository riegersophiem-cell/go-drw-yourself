import { describe, expect, it } from "vitest";
import type { PendingGameEvent } from "../src/game/gameEvents";
import type { PublicGameState, PublicPlayerView } from "../src/game/types";
import { applyEventToPublicState, buildPresentationSnapshots } from "../src/multiplayer/presentationState";

function player(id: string, overrides: Partial<PublicPlayerView> = {}): PublicPlayerView {
  return { playerId: id, displayName: id, type: "BOT", avatar: "BOT1", seatIndex: Number(id.slice(1)), cardCount: 5, connected: true, eliminated: false, ...overrides };
}

function state(overrides: Partial<PublicGameState> = {}): PublicGameState {
  return {
    roomId: "r", gameId: "g", version: 10, status: "PLAYING", direction: 1, phase: "WAITING_FOR_PLAY",
    currentPlayerId: "p0", players: [player("p0"), player("p1"), player("p2")],
    topDiscard: { defId: "d0", color: "RED", type: "TRIANGLE" }, activeColor: "RED",
    pendingEffect: null, pendingSkipTargets: {}, drawPileCount: 50, winnerPlayerId: null,
    ...overrides,
  };
}

describe("applyEventToPublicState", () => {
  it("moves the discard top and active color to whatever this single event just played, not the final result", () => {
    const before = state();
    const afterPlay = applyEventToPublicState(before, {
      sequence: 0, actorPlayerId: "p1", type: "PLAY_CARD", payload: { playerId: "p1", color: "BLUE", cardType: "SKIP" }, resultVersion: 11,
    });
    expect(afterPlay.topDiscard).toEqual({ defId: "presentation_BLUE_SKIP", color: "BLUE", type: "SKIP" });
    expect(afterPlay.activeColor).toBe("BLUE");
    expect(afterPlay.currentPlayerId).toBe("p1");
    expect(afterPlay.players.find((p) => p.playerId === "p1")!.cardCount).toBe(4);
  });

  it("reproduces the exact reported bug: a multi-bot chain must show each intermediate top card, not the last bot's future play from the very first beat", () => {
    const before = state({ topDiscard: { defId: "d0", color: "RED", type: "TRIANGLE" }, activeColor: "RED", currentPlayerId: "p0" });
    const events: PendingGameEvent[] = [
      { sequence: 0, actorPlayerId: "p1", type: "PLAY_CARD", payload: { playerId: "p1", color: "BLUE", cardType: "SKIP" }, resultVersion: 11 },
      { sequence: 1, actorPlayerId: "p2", type: "PLAY_CARD", payload: { playerId: "p2", color: "GREEN", cardType: "REVERSE" }, resultVersion: 12 },
    ];
    const snapshots = buildPresentationSnapshots(before, events);

    // Bot 1's beat: the board must show BOT 1's card, not bot 2's later one.
    expect(snapshots[0].topDiscard?.type).toBe("SKIP");
    expect(snapshots[0].activeColor).toBe("BLUE");
    expect(snapshots[0].currentPlayerId).toBe("p1");

    // Only once bot 2's own event has been replayed does the board move on.
    expect(snapshots[1].topDiscard?.type).toBe("REVERSE");
    expect(snapshots[1].activeColor).toBe("GREEN");
    expect(snapshots[1].currentPlayerId).toBe("p2");

    // The live/final publicState (what the old code fed straight into
    // GameTable from beat 1 onward) would already show bot 2's card - that's
    // exactly the mismatch this reconstruction exists to avoid mid-chain.
    expect(snapshots[0].topDiscard?.type).not.toBe(snapshots[1].topDiscard?.type);
  });

  it("resolving a pending draw stack moves cards from the draw pile to the drawing player's hand", () => {
    const before = state({ drawPileCount: 40 });
    const after = applyEventToPublicState(before, {
      sequence: 0, actorPlayerId: "p0", type: "DRAW_STACK_RESOLVED", payload: { playerId: "p0", amount: 4 }, resultVersion: 11,
    });
    expect(after.players.find((p) => p.playerId === "p0")!.cardCount).toBe(9);
    expect(after.drawPileCount).toBe(36);
  });

  it("rotates card counts one seat forward in the direction of play", () => {
    const before = state({
      direction: 1,
      players: [player("p0", { cardCount: 3 }), player("p1", { cardCount: 5 }), player("p2", { cardCount: 7 })],
    });
    const after = applyEventToPublicState(before, { sequence: 0, actorPlayerId: "p0", type: "HANDS_ROTATED", payload: {}, resultVersion: 11 });
    // Each player receives the hand of whoever sits behind them in turn direction.
    expect(after.players.map((p) => p.cardCount)).toEqual([7, 3, 5]);
  });

  it("swaps card counts between exactly the two named players", () => {
    const before = state({ players: [player("p0", { cardCount: 3 }), player("p1", { cardCount: 9 }), player("p2", { cardCount: 5 })] });
    const after = applyEventToPublicState(before, {
      sequence: 0, actorPlayerId: "p0", type: "HANDS_SWAPPED", payload: { playerAId: "p0", playerBId: "p2" }, resultVersion: 11,
    });
    expect(after.players.map((p) => p.cardCount)).toEqual([5, 9, 3]);
  });

  it("marks a pending skip target without touching the discard pile", () => {
    const before = state();
    const after = applyEventToPublicState(before, {
      sequence: 0, actorPlayerId: "p0", type: "CHOSE_SKIP_TARGET", payload: { playerId: "p0", targetPlayerId: "p2" }, resultVersion: 11,
    });
    expect(after.pendingSkipTargets).toEqual({ p2: 1 });
    expect(after.topDiscard).toEqual(before.topDiscard);
  });

  it("an extra discard reduces the hand but never becomes the visible top card", () => {
    const before = state();
    const after = applyEventToPublicState(before, {
      sequence: 0, actorPlayerId: "p0", type: "DISCARDED_EXTRA", payload: { playerId: "p0", color: "GREEN", cardType: "CIRCLE" }, resultVersion: 11,
    });
    expect(after.topDiscard).toEqual(before.topDiscard);
    expect(after.players.find((p) => p.playerId === "p0")!.cardCount).toBe(4);
  });

  it("tracks a growing draw stack live and clears it once someone takes it", () => {
    const before = state({ pendingEffect: null });
    const stacked = applyEventToPublicState(before, {
      sequence: 0, actorPlayerId: "p1", type: "DRAW_STACK_INCREASED", payload: { playerId: "p1", addedAmount: 4, totalAmount: 4 }, resultVersion: 11,
    });
    expect(stacked.pendingEffect).toEqual({ type: "DRAW_STACK", amount: 4, lastDrawValue: 4, terminal: false, sourcePlayerId: "p1" });
    const resolved = applyEventToPublicState(stacked, {
      sequence: 1, actorPlayerId: "p2", type: "DRAW_STACK_RESOLVED", payload: { playerId: "p2", amount: 4 }, resultVersion: 12,
    });
    expect(resolved.pendingEffect).toBeNull();
  });

  it("marks a player eliminated in place", () => {
    const before = state();
    const after = applyEventToPublicState(before, { sequence: 0, actorPlayerId: "p1", type: "PLAYER_ELIMINATED", payload: { playerId: "p1", reason: "RULE" }, resultVersion: 11 });
    expect(after.players.find((p) => p.playerId === "p1")!.eliminated).toBe(true);
  });
});
