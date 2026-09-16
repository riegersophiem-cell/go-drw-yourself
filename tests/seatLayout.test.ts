import { describe, expect, it } from "vitest";
import { resolveSeatOrder, swapSeats } from "../src/game/seatLayout";

const players = [{ playerId: "a" }, { playerId: "b" }, { playerId: "c" }];

describe("resolveSeatOrder", () => {
  it("returns natural order when no seat layout is stored", () => {
    expect(resolveSeatOrder(players, null).map((p) => p.playerId)).toEqual(["a", "b", "c"]);
  });

  it("applies a stored order", () => {
    expect(resolveSeatOrder(players, ["c", "a", "b"]).map((p) => p.playerId)).toEqual(["c", "a", "b"]);
  });

  it("appends a new joiner not present in the stored order", () => {
    expect(resolveSeatOrder(players, ["b", "a"]).map((p) => p.playerId)).toEqual(["b", "a", "c"]);
  });

  it("drops stale ids for players who are no longer seated", () => {
    expect(resolveSeatOrder(players, ["z", "c", "a", "b"]).map((p) => p.playerId)).toEqual(["c", "a", "b"]);
  });
});

describe("swapSeats", () => {
  it("swaps two players' visual slots without touching identity/order elsewhere", () => {
    expect(swapSeats(players, "a", "c")).toEqual(["c", "b", "a"]);
  });

  it("is a no-op for an unknown id or swapping a seat with itself", () => {
    expect(swapSeats(players, "a", "a")).toEqual(["a", "b", "c"]);
    expect(swapSeats(players, "a", "zzz")).toEqual(["a", "b", "c"]);
  });
});
