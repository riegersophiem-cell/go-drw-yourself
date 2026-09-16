import { useCallback, useState } from "react";
import type { PresentationBatch } from "../multiplayer/presentationState";

/**
 * Paket 4: holds the queue of batches `useRoomRealtime` has decided are
 * worth presenting (BOT_TURN_ARCHITECTURE.md §6.4), without rendering or
 * playing back anything itself — that lands in Paket 5. This hook exists so
 * the accumulation/reset wiring can be exercised and reasoned about on its
 * own, ahead of any visible UI consuming the queue.
 */
export function useEventPresentation() {
  const [queue, setQueue] = useState<PresentationBatch[]>([]);

  const enqueueBatch = useCallback((batch: PresentationBatch) => {
    setQueue((prev) => [...prev, batch]);
  }, []);

  const resetQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const acknowledgeBatch = useCallback((batchId: string) => {
    setQueue((prev) => {
      const index = prev.findIndex((batch) => batch.batchId === batchId);
      return index < 0 ? prev : prev.slice(index + 1);
    });
  }, []);

  return { queue, enqueueBatch, resetQueue, acknowledgeBatch };
}
