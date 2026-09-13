import { describe, expect, it } from "vitest";
import type { GameEventBatch, PendingGameEvent } from "../src/game/gameEvents";
import { buildPlaybackBeats, playbackBeatText } from "../src/multiplayer/playbackBeats";

function batch(events: PendingGameEvent[]): GameEventBatch { return { batchId: "b", roomId: "r", gameId: "g", fromVersion: 1, toVersion: 2, events }; }
const names = (id: string | null | undefined) => ({ a: "Bot 2", b: "Sophie" }[id ?? ""] ?? "Unbekannt");

describe("buildPlaybackBeats", () => {
  it("combines a played wild card and its color choice into one readable beat", () => {
    const beats = buildPlaybackBeats(batch([
      { sequence: 0, actorPlayerId: "a", type: "PLAY_CARD", payload: { playerId: "a", color: "WILD", cardType: "WILD" }, resultVersion: 2 },
      { sequence: 1, actorPlayerId: "a", type: "CHOSE_COLOR", payload: { playerId: "a", color: "RED" }, resultVersion: 2 },
    ]));
    expect(beats).toHaveLength(1);
    expect(playbackBeatText(beats[0], names)).toBe("Bot 2 spielt WILD · WILD und wählt Rot.");
  });

  it("combines target selection and the matching hand swap", () => {
    const beats = buildPlaybackBeats(batch([
      { sequence: 0, actorPlayerId: "a", type: "CHOSE_SWAP_TARGET", payload: { playerId: "a", targetPlayerId: "b" }, resultVersion: 2 },
      { sequence: 1, actorPlayerId: "a", type: "HANDS_SWAPPED", payload: { playerAId: "a", playerBId: "b" }, resultVersion: 2 },
    ]));
    expect(beats).toHaveLength(1);
    expect(playbackBeatText(beats[0], names)).toBe("Bot 2 tauscht die Hand mit Sophie.");
  });

  it("caps a large draw animation and writes correct singular/plural text", () => {
    const one = buildPlaybackBeats(batch([{ sequence: 0, actorPlayerId: "a", type: "DRAW", payload: { playerId: "a", count: 1 }, resultVersion: 2 }]))[0];
    const many = buildPlaybackBeats(batch([{ sequence: 0, actorPlayerId: "a", type: "DRAW", payload: { playerId: "a", count: 20 }, resultVersion: 2 }]))[0];
    expect(playbackBeatText(one, names)).toBe("Bot 2 zieht 1 Karte.");
    expect(many.durationMs).toBe(1350);
  });
});
