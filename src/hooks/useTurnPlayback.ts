import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameEventBatch } from "../game/gameEvents";
import { buildPlaybackBeats, type PlaybackBeat } from "../multiplayer/playbackBeats";
import { pacedDuration } from "../multiplayer/playbackMachine";

interface ActiveBatch { batchId: string; gameId: string; beats: PlaybackBeat[]; }

export function useTurnPlayback(params: {
  queue: GameEventBatch[];
  gameId: string | null;
  acknowledgeBatch: (batchId: string) => void;
  clearQueue: () => void;
}) {
  const { queue, gameId, acknowledgeBatch, clearQueue } = params;
  const [active, setActive] = useState<ActiveBatch | null>(null);
  const [beatIndex, setBeatIndex] = useState(0);
  const [skipReady, setSkipReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(() => document.hidden);
  const generation = useRef(0);
  const chainStartedAt = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const timerDeadline = useRef(0);
  const remainingDuration = useRef<number | null>(null);
  const scheduledBeatId = useRef<string | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (active || !queue.length) return;
    const batch = queue[0];
    const beats = buildPlaybackBeats(batch);
    if (!beats.length) { acknowledgeBatch(batch.batchId); return; }
    generation.current += 1;
    chainStartedAt.current = performance.now();
    // State here intentionally follows an external queue notification.
    // oxlint-disable-next-line react/set-state-in-effect
    setBeatIndex(0);
    // oxlint-disable-next-line react/set-state-in-effect
    setSkipReady(false);
    // oxlint-disable-next-line react/set-state-in-effect
    setActive({ batchId: batch.batchId, gameId: batch.gameId, beats });
  }, [active, queue, acknowledgeBatch]);

  // UX spec: the skip button becomes clickable 500ms after a chain starts,
  // so an accidental double-click right after pressing "play" doesn't also
  // wipe the whole chain it just started.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setSkipReady(true), 500);
    return () => window.clearTimeout(timer);
    // `active` (not beatIndex) is the right key: it only changes reference
    // when a new batch actually starts, so this re-arms once per batch, not
    // on every beat within the same batch.
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (gameId && active.gameId !== gameId) {
      generation.current += 1;
      // Cancels presentation state when the authoritative round changes.
      // oxlint-disable-next-line react/set-state-in-effect
      setActive(null);
      // oxlint-disable-next-line react/set-state-in-effect
      setBeatIndex(0);
    }
  }, [active, gameId]);

  useEffect(() => {
    if (!active) return;
    const currentGeneration = generation.current;
    const beat = active.beats[beatIndex];
    if (scheduledBeatId.current !== beat.id) {
      scheduledBeatId.current = beat.id;
      const elapsed = performance.now() - chainStartedAt.current;
      const duration = pacedDuration(beat.durationMs, beatIndex, elapsed, reducedMotion);
      remainingDuration.current = duration + (beatIndex + 1 >= active.beats.length && !reducedMotion ? 120 : 0);
    }
    if (paused) return;
    const isLast = beatIndex + 1 >= active.beats.length;
    const delay = remainingDuration.current ?? 0;
    timerDeadline.current = performance.now() + delay;
    const timer = window.setTimeout(() => {
      if (generation.current !== currentGeneration) return;
      remainingDuration.current = null;
      scheduledBeatId.current = null;
      if (!isLast) setBeatIndex((index) => index + 1);
      else {
        acknowledgeBatch(active.batchId);
        setActive(null);
        setBeatIndex(0);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [active, beatIndex, acknowledgeBatch, paused, reducedMotion]);

  const skip = useCallback(() => {
    generation.current += 1;
    remainingDuration.current = null;
    scheduledBeatId.current = null;
    hiddenAt.current = null;
    clearQueue();
    setActive(null);
    setBeatIndex(0);
    // skip() is also how the >2s-hidden auto-skip resolves (called while
    // paused is still true from the visibilitychange handler) - without this,
    // the NEXT batch starts already "paused" and its beat-advance effect bails
    // out on its very first tick, freezing the narrator on beat 1 forever.
    // Confirmed live: after one long-hide auto-skip, a later chain got stuck
    // permanently on its first beat until Escape/skip was pressed manually.
    setPaused(false);
  }, [clearQueue]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = performance.now();
        if (active) {
          remainingDuration.current = Math.max(0, timerDeadline.current - performance.now());
        }
        // Pausing follows a browser visibility event, not derived render state.
        // oxlint-disable-next-line react/set-state-in-effect
        setPaused(true);
      }
      else if (hiddenAt.current !== null) {
        if (performance.now() - hiddenAt.current > 2000) skip();
        else {
          // Resume the current beat with the time that was still visible.
          // oxlint-disable-next-line react/set-state-in-effect
          setPaused(false);
        }
        hiddenAt.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, skip]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") skip(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, skip]);

  const queuedBeatCount = useMemo(() => queue.reduce((count, batch) => count + buildPlaybackBeats(batch).length, 0), [queue]);
  return {
    activeBeat: active?.beats[beatIndex] ?? null,
    isPlaying: active !== null,
    position: active ? beatIndex + 1 : 0,
    total: active?.beats.length ?? 0,
    canSkip: active !== null && queuedBeatCount >= 2 && skipReady,
    reducedMotion,
    skip,
  };
}
