import { describe, expect, it } from "vitest";
import { advancePlayback, pacedDuration, skipPlayback, startPlayback } from "../src/multiplayer/playbackMachine";

describe("playbackMachine", () => {
  it("starts, advances and settles deterministically", () => {
    const started = startPlayback([{} as never, {} as never]);
    expect(started).toEqual({ index: 0, status: "PLAYING" });
    expect(advancePlayback(started, 2)).toEqual({ index: 1, status: "PLAYING" });
    expect(advancePlayback({ index: 1, status: "PLAYING" }, 2).status).toBe("SETTLING");
  });

  it("skips active playback and uses balanced acceleration", () => {
    expect(skipPlayback({ index: 0, status: "PLAYING" }).status).toBe("SKIPPED");
    expect(pacedDuration(1000, 0, 0, false)).toBe(1000);
    expect(pacedDuration(1000, 3, 0, false)).toBe(850);
    expect(pacedDuration(1000, 3, 9000, false)).toBe(510);
    expect(pacedDuration(1000, 0, 0, true)).toBe(180);
  });
});
