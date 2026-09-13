import type { PlaybackBeat } from "./playbackBeats";

export interface PlaybackCursor { index: number; status: "IDLE" | "PLAYING" | "SETTLING" | "SKIPPED"; }

export function startPlayback(beats: PlaybackBeat[]): PlaybackCursor {
  return beats.length ? { index: 0, status: "PLAYING" } : { index: 0, status: "IDLE" };
}

export function advancePlayback(cursor: PlaybackCursor, beatCount: number): PlaybackCursor {
  if (cursor.status !== "PLAYING") return cursor;
  return cursor.index + 1 < beatCount ? { index: cursor.index + 1, status: "PLAYING" } : { index: cursor.index, status: "SETTLING" };
}

export function skipPlayback(cursor: PlaybackCursor): PlaybackCursor {
  return cursor.status === "IDLE" ? cursor : { ...cursor, status: "SKIPPED" };
}

/** Balanced pacing: gently speeds long chains up, with a stronger cap after nine seconds. */
export function pacedDuration(baseMs: number, beatIndex: number, elapsedMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 180;
  const chainFactor = beatIndex >= 3 ? 0.85 : 1;
  const longFactor = elapsedMs >= 9000 ? 0.6 : 1;
  return Math.max(180, Math.round(baseMs * chainFactor * longFactor));
}
