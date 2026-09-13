import { describe, expect, it } from "vitest";
import { createNewGame } from "../src/game/gameState";
import { forfeitPlayer } from "../src/game/playerDeparture";

function game() {
  return createNewGame("room", [
    { playerId: "a", displayName: "A", type: "HUMAN" },
    { playerId: "b", displayName: "B", type: "HUMAN" },
    { playerId: "c", displayName: "C", type: "BOT" },
  ], undefined, () => 0.42);
}

describe("forfeitPlayer", () => {
  it("skips a departing current player and keeps the round running", () => {
    const before = game();
    const after = forfeitPlayer(before, "a");
    expect(after.players.find((player) => player.playerId === "a")).toMatchObject({ eliminated: true, connected: false });
    expect(after.currentPlayerId).toBe("b");
    expect(after.phase).toBe("WAITING_FOR_PLAY");
    expect(after.version).toBe(before.version + 1);
  });

  it("does not change the current turn when another player leaves", () => {
    const before = game();
    const after = forfeitPlayer(before, "b");
    expect(after.currentPlayerId).toBe("a");
    expect(after.turnNumber).toBe(before.turnNumber);
  });

  it("clears a departing player's unresolved choice", () => {
    const before = { ...game(), phase: "WAITING_FOR_SWAP_TARGET" as const, pendingSwapPlayerId: "a" };
    const after = forfeitPlayer(before, "a");
    expect(after.phase).toBe("WAITING_FOR_PLAY");
    expect(after.pendingSwapPlayerId).toBeNull();
  });

  it("clears a color choice when the current player leaves", () => {
    const before = { ...game(), phase: "WAITING_FOR_COLOR" as const };
    const after = forfeitPlayer(before, "a");
    expect(after.phase).toBe("WAITING_FOR_PLAY");
    expect(after.currentPlayerId).toBe("b");
  });

  it("finishes the round when only one active player remains", () => {
    const before = game();
    const withOneAlreadyOut = { ...before, players: before.players.map((player) => player.playerId === "c" ? { ...player, eliminated: true } : player) };
    const after = forfeitPlayer(withOneAlreadyOut, "a");
    expect(after.phase).toBe("GAME_OVER");
    expect(after.winnerPlayerId).toBe("b");
  });
});
