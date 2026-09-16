import { useEffect, useState } from "react";
import type { DeviceSession } from "../multiplayer/session";
import { supabase } from "../supabase/client";

export interface RoomHostInfo {
  isHost: boolean;
  /** The room's current host device — exposed (not just the isHost boolean) so a
   * player list can mark *which* row is the host, not just tell "you are/aren't". */
  hostDeviceId: string | null;
}

/** Keeps host controls correct when the current host leaves and ownership moves. */
export function useIsRoomHost(session: DeviceSession): RoomHostInfo {
  const [hostDeviceId, setHostDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => supabase.from("rooms").select("host_device_id").eq("room_id", session.roomId).single()
      .then(({ data }) => { if (!cancelled) setHostDeviceId(data?.host_device_id ?? null); });
    void refresh();
    const channel = supabase.channel(`room:${session.roomId}:host`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `room_id=eq.${session.roomId}` }, (payload) => {
        if (!cancelled) setHostDeviceId((payload.new as { host_device_id?: string }).host_device_id ?? null);
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [session.deviceId, session.roomId]);

  return { isHost: hostDeviceId === session.deviceId, hostDeviceId };
}
