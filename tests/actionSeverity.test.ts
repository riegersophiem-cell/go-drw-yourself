import { describe, expect, it } from "vitest";
import { classifyBeatSeverity, clampDurationForSeverity } from "../src/game/actionSeverity";
import type { PlaybackBeat } from "../src/multiplayer/playbackBeats";

function beat(overrides: Partial<PlaybackBeat>): PlaybackBeat {
  return { id: "b1", kind: "PLAY", actorPlayerId: "p1", durationMs: 1000, resultVersion: 1, ...overrides };
}

describe("classifyBeatSeverity", () => {
  it("classifies Chaos family plays/beats as MAJOR", () => {
    expect(classifyBeatSeverity(beat({ kind: "SWAP" }))).toBe("MAJOR");
    expect(classifyBeatSeverity(beat({ kind: "ROTATE" }))).toBe("MAJOR");
    expect(classifyBeatSeverity(beat({ kind: "PLAY", card: { color: "WILD", type: "SKIP_EVERYONE" } }))).toBe("MAJOR");
    expect(classifyBeatSeverity(beat({ kind: "PLAY", card: { color: "WILD", type: "WILD_DRAW_10" } }))).toBe("MAJOR");
    expect(classifyBeatSeverity(beat({ kind: "PLAY", card: { color: "WILD", type: "WILD_COLOR_ROULETTE" } }))).toBe("MAJOR");
  });

  it("classifies normal action cards as STANDARD", () => {
    expect(classifyBeatSeverity(beat({ kind: "SKIP" }))).toBe("STANDARD");
    expect(classifyBeatSeverity(beat({ kind: "STACK" }))).toBe("STANDARD");
    expect(classifyBeatSeverity(beat({ kind: "PLAY", card: { color: "RED", type: "TARGET_SKIP" } }))).toBe("STANDARD");
    expect(classifyBeatSeverity(beat({ kind: "PLAY", card: { color: "BLUE", type: "DRAW_2" } }))).toBe("STANDARD");
  });

  it("classifies a plain Basic card play as NONE (no dedicated stage)", () => {
    expect(classifyBeatSeverity(beat({ kind: "PLAY", card: { color: "GREEN", type: "TRIANGLE" } }))).toBe("NONE");
  });

  it("DITCH's extra discard never gets its own focus stage", () => {
    expect(classifyBeatSeverity(beat({ kind: "EXTRA", card: { color: "RED", type: "TRIANGLE" } }))).toBe("NONE");
  });

  it("a lone forced draw (no stack) is NONE, a resolved stack draw is STANDARD", () => {
    expect(classifyBeatSeverity(beat({ kind: "DRAW" }))).toBe("NONE");
    expect(classifyBeatSeverity(beat({ kind: "DRAW", totalAmount: 4 }))).toBe("STANDARD");
  });
});

describe("clampDurationForSeverity", () => {
  it("allows MAJOR beats up to ~5s, well past the old 1.6s cap", () => {
    expect(clampDurationForSeverity(4800, "MAJOR")).toBe(4800);
    expect(clampDurationForSeverity(9000, "MAJOR")).toBe(5000);
  });

  it("keeps STANDARD beats within the 1-2.5s band", () => {
    expect(clampDurationForSeverity(400, "STANDARD")).toBe(1000);
    expect(clampDurationForSeverity(4000, "STANDARD")).toBe(2500);
  });
});
