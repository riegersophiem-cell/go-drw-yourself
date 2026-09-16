import { useEffect, useRef, useState } from "react";
import { fetchPlayers, fetchPrivateState, fetchPublicState } from "../multiplayer/api";
import { supabase } from "../supabase/client";
import type { PrivatePlayerState, PublicGameState } from "../game/types";
import { reconcileBroadcastPayload, type KnownRoundState } from "../multiplayer/batchReconciliation";
import { useEventPresentation } from "./useEventPresentation";
import type { AvatarId } from "../game/avatars";

export interface RoomPlayerRow {
  player_id: string;
  display_name: string;
  player_type: "HUMAN" | "BOT";
  avatar: AvatarId;
  seat_index: number;
  eliminated: boolean;
  connected: boolean;
  wins: number;
  /** null for bots (they never get a devices row) and for a player whose device departed mid-game. */
  device_id: string | null;
}

/**
 * Subscribes to the room's public broadcast channel. Every "state_changed"
 * broadcast now carries a full `GameEventBatch` (BOT_TURN_ARCHITECTURE.md
 * §5.9/§6.2) rather than just a bare version bump, but its content is never
 * trusted directly: the hook always refetches the authoritative public/
 * private state first, and only enqueues the batch for later presentation
 * (Paket 5) once that refetch confirms it actually landed on exactly the
 * round/version the batch claims to produce — see `decideBatchAcceptance`.
 * Reconnect/initial mount never enqueues anything: there is no batch at
 * that point, only a direct state fetch, so no old events are ever replayed.
 */
export function useRoomRealtime(roomId: string | null, device?: { deviceId: string; sessionToken: string } | null) {
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRow[]>([]);
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const lastKnownRef = useRef<KnownRoundState | null>(null);
  // Tracks whatever `publicState` last rendered, so a new batch's own events
  // can be replayed on top of the board as it looked right before this
  // batch — not the final result the confirming refetch below is about to
  // overwrite `publicState` with (see presentationState.ts's header comment
  // for why this distinction is the actual bot-turn-timing fix).
  const publicStateRef = useRef<PublicGameState | null>(null);
  const presentation = useEventPresentation();

  async function refetchAll(currentRoomId: string): Promise<PublicGameState | null> {
    const [pub, plist] = await Promise.all([fetchPublicState(currentRoomId), fetchPlayers(currentRoomId)]);
    setPublicState(pub);
    publicStateRef.current = pub;
    setPlayers(plist as RoomPlayerRow[]);
    const dev = deviceRef.current;
    if (dev) {
      const priv = await fetchPrivateState(dev.deviceId, dev.sessionToken);
      setPrivateState(priv);
    }
    if (pub) lastKnownRef.current = { gameId: pub.gameId, version: pub.version };
    return pub;
  }

  async function handleBatchBroadcast(currentRoomId: string, payload: unknown) {
    const lastKnown = lastKnownRef.current;
    // Snapshot BEFORE the confirming refetch (inside reconcileBroadcastPayload)
    // overwrites publicStateRef with this batch's own final result.
    const baseState = publicStateRef.current;
    const result = await reconcileBroadcastPayload({
      payload,
      lastKnown,
      refetchAuthoritative: async () => {
        const pub = await refetchAll(currentRoomId);
        return pub ? { gameId: pub.gameId, version: pub.version } : null;
      },
    });
    if (result.kind === "invalid_payload") {
      console.error("discarding structurally invalid batch broadcast", payload);
      return;
    }
    if (result.kind !== "batch" || result.decision.kind === "discard") return;
    if (result.decision.resetQueue) presentation.resetQueue();
    // baseState is only trustworthy as this batch's starting point when it's
    // exactly the version the batch claims to extend from — otherwise (a
    // missed broadcast, a reconnect mid-chain) fall back to null and let
    // useTurnPlayback skip reconstruction for this batch rather than replay
    // events onto a board they were never meant to follow.
    const validBase = baseState && baseState.gameId === result.batch.gameId && baseState.version === result.batch.fromVersion ? baseState : null;
    presentation.enqueueBatch({ ...result.batch, baseState: validBase });
  }

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    refetchAll(roomId).catch((err) => console.error("initial fetch failed", err));

    const channel = supabase
      .channel(`room:${roomId}:public`)
      .on("broadcast", { event: "state_changed" }, ({ payload }) => {
        if (!cancelled) handleBatchBroadcast(roomId, payload).catch((err) => console.error("refetch failed", err));
      })
      .subscribe();

    const playersChannel = supabase
      .channel(`room:${roomId}:players`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, () => {
        if (!cancelled) fetchPlayers(roomId).then((p) => !cancelled && setPlayers(p as RoomPlayerRow[]));
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(playersChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  return {
    publicState,
    privateState,
    players,
    presentationQueue: presentation.queue,
    acknowledgePresentationBatch: presentation.acknowledgeBatch,
    clearPresentationQueue: presentation.resetQueue,
    refetch: () => roomId && refetchAll(roomId),
  };
}
