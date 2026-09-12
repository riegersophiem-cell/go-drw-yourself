import { useEffect, useRef, useState } from "react";
import { fetchPlayers, fetchPrivateState, fetchPublicState } from "../multiplayer/api";
import { supabase } from "../supabase/client";
import type { PrivatePlayerState, PublicGameState } from "../game/types";

export interface RoomPlayerRow {
  player_id: string;
  display_name: string;
  player_type: "HUMAN" | "BOT";
  seat_index: number;
  eliminated: boolean;
  connected: boolean;
  wins: number;
}

/**
 * Subscribes to the room's public broadcast channel. On every "state
 * changed" signal (which carries no secret data, only a version bump) it
 * refetches the public view for everyone, and — only if a deviceId/token was
 * given — the caller's own private view via the guarded RPC.
 */
export function useRoomRealtime(roomId: string | null, device?: { deviceId: string; sessionToken: string } | null) {
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);
  const [privateState, setPrivateState] = useState<PrivatePlayerState | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRow[]>([]);
  const deviceRef = useRef(device);
  deviceRef.current = device;

  async function refetchAll(currentRoomId: string) {
    const [pub, plist] = await Promise.all([fetchPublicState(currentRoomId), fetchPlayers(currentRoomId)]);
    setPublicState(pub);
    setPlayers(plist as RoomPlayerRow[]);
    const dev = deviceRef.current;
    if (dev) {
      const priv = await fetchPrivateState(dev.deviceId, dev.sessionToken);
      setPrivateState(priv);
    }
  }

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    refetchAll(roomId).catch((err) => console.error("initial fetch failed", err));

    const channel = supabase
      .channel(`room:${roomId}:public`)
      .on("broadcast", { event: "state_changed" }, () => {
        if (!cancelled) refetchAll(roomId).catch((err) => console.error("refetch failed", err));
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

  return { publicState, privateState, players, refetch: () => roomId && refetchAll(roomId) };
}
