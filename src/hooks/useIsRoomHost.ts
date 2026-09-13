import { useEffect, useState } from "react";
import type { DeviceSession } from "../multiplayer/session";
import { supabase } from "../supabase/client";

/** Keeps host controls correct when the current host leaves and ownership moves. */
export function useIsRoomHost(session: DeviceSession): boolean {
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => supabase.from("rooms").select("host_device_id").eq("room_id", session.roomId).single()
      .then(({ data }) => { if (!cancelled) setIsHost(data?.host_device_id === session.deviceId); });
    void refresh();
    const channel = supabase.channel(`room:${session.roomId}:host`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `room_id=eq.${session.roomId}` }, (payload) => {
        if (!cancelled) setIsHost((payload.new as { host_device_id?: string }).host_device_id === session.deviceId);
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [session.deviceId, session.roomId]);

  return isHost;
}
