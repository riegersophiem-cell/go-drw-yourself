import type { GameEventBatch } from "../game/gameEvents";

/** The room/round identity this client has most recently confirmed via a server refetch. */
export interface KnownRoundState {
  gameId: string;
  version: number;
}

/**
 * Structurally validates a broadcast payload as a `GameEventBatch`, without
 * trusting any of its content beyond shape: `gameId`/`batchId` are strings,
 * `fromVersion`/`toVersion` are integers with `toVersion >= fromVersion`,
 * `events` is an array whose `sequence` values are unique and form exactly
 * `{0, 1, ..., events.length - 1}` (mirrors the server-side check in
 * `apply_turn_batch`, BOT_TURN_ARCHITECTURE.md §5.4 Schritt 6 — a client
 * only ever receives what the server already validated, but the broadcast
 * transport itself is untrusted and must be re-checked here).
 */
export function validateBatchShape(value: unknown): value is GameEventBatch {
  if (!value || typeof value !== "object") return false;
  const batch = value as Record<string, unknown>;
  if (typeof batch.gameId !== "string" || batch.gameId.length === 0) return false;
  if (typeof batch.batchId !== "string" || batch.batchId.length === 0) return false;
  if (!Number.isInteger(batch.fromVersion) || !Number.isInteger(batch.toVersion)) return false;
  if ((batch.toVersion as number) < (batch.fromVersion as number)) return false;
  if (!Array.isArray(batch.events)) return false;

  const events = batch.events as unknown[];
  const sequences = new Set<number>();
  for (const event of events) {
    if (!event || typeof event !== "object") return false;
    const sequence = (event as Record<string, unknown>).sequence;
    if (!Number.isInteger(sequence)) return false;
    sequences.add(sequence as number);
  }
  if (sequences.size !== events.length) return false;
  for (let i = 0; i < events.length; i++) {
    if (!sequences.has(i)) return false;
  }
  return true;
}

export type BatchDecision =
  | { kind: "accept"; resetQueue: boolean }
  | { kind: "discard"; reason: "STALE_ROUND_ECHO" | "SUPERSEDED" | "REFETCH_BEHIND_BATCH" | "DUPLICATE_OR_OLD" | "VERSION_GAP" };

export type BroadcastReconciliation =
  | { kind: "no_state" }
  | { kind: "invalid_payload" }
  | { kind: "batch"; batch: GameEventBatch; decision: BatchDecision };

/**
 * Refetches authoritative state for every state_changed notification before
 * deciding whether its untrusted payload is useful for presentation. A bad
 * payload may suppress animation events, but must never suppress the state
 * update that the notification announces.
 */
export async function reconcileBroadcastPayload(params: {
  payload: unknown;
  lastKnown: KnownRoundState | null;
  refetchAuthoritative: () => Promise<KnownRoundState | null>;
}): Promise<BroadcastReconciliation> {
  const refetched = await params.refetchAuthoritative();
  if (!refetched) return { kind: "no_state" };
  if (!validateBatchShape(params.payload)) return { kind: "invalid_payload" };
  const batch = params.payload as GameEventBatch;
  return {
    kind: "batch",
    batch,
    decision: decideBatchAcceptance({
      batch,
      refetchedGameId: refetched.gameId,
      refetchedVersion: refetched.version,
      lastKnown: params.lastKnown,
    }),
  };
}

/**
 * Decides whether a structurally valid batch may be enqueued for later
 * presentation (BOT_TURN_ARCHITECTURE.md §6.2/§6.4).
 *
 * The batch's own claimed `gameId`/`toVersion` are never trusted on their
 * own — only the freshly refetched, server-authoritative `refetchedGameId`/
 * `refetchedVersion` decide anything. A batch is only ever accepted when the
 * refetch lands EXACTLY on `(batch.gameId, batch.toVersion)`:
 *
 * - a refetch pointing at a different `gameId` than the batch means the
 *   batch is either a stale echo of an already-superseded round (if the
 *   refetch's `gameId` differs from both the batch AND `lastKnown`) or,
 *   when it happens to match the CALLER's own already-applied round, simply
 *   irrelevant now — either way it is discarded, but the refetched state is
 *   still authoritative and must always be applied by the caller regardless
 *   of this function's verdict;
 * - a refetch version higher than `batch.toVersion` (same `gameId`) means a
 *   later batch already overtook this one — discard, state still updates;
 * - a refetch version lower than `batch.toVersion` means the refetch raced
 *   ahead of the write this broadcast announced (should be rare/transient)
 *   — discard for now, a later broadcast/refetch will catch up;
 * - within the same round, the batch must extend exactly from `lastKnown`'s
 *   version (`batch.fromVersion === lastKnown.version`); a duplicate or an
 *   already-overtaken batch has `batch.toVersion <= lastKnown.version`, a
 *   version gap has `batch.fromVersion` strictly greater than it — both are
 *   discarded rather than displayed out of order or with missing steps;
 * - a brand new round (`lastKnown` is `null`, or its `gameId` differs from
 *   the batch/refetch) always accepts and signals `resetQueue: true` so the
 *   caller clears any leftover presentation state from the previous round.
 */
export function decideBatchAcceptance(params: {
  batch: GameEventBatch;
  refetchedGameId: string;
  refetchedVersion: number;
  lastKnown: KnownRoundState | null;
}): BatchDecision {
  const { batch, refetchedGameId, refetchedVersion, lastKnown } = params;

  if (refetchedGameId !== batch.gameId) {
    return { kind: "discard", reason: "STALE_ROUND_ECHO" };
  }
  if (refetchedVersion > batch.toVersion) {
    return { kind: "discard", reason: "SUPERSEDED" };
  }
  if (refetchedVersion < batch.toVersion) {
    return { kind: "discard", reason: "REFETCH_BEHIND_BATCH" };
  }

  const isNewRound = lastKnown === null || lastKnown.gameId !== batch.gameId;
  if (!isNewRound && batch.fromVersion !== lastKnown!.version) {
    return { kind: "discard", reason: batch.toVersion <= lastKnown!.version ? "DUPLICATE_OR_OLD" : "VERSION_GAP" };
  }
  return { kind: "accept", resetQueue: isNewRound };
}
