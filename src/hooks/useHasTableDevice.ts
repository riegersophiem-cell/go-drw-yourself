import { useEffect, useState } from "react";
import { supabase } from "../supabase/client";

export function useHasTableDevice(roomId: string): boolean {
  const [hasTableDevice, setHasTableDevice] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const { data, error } = await supabase
        .from("devices")
        .select("device_id")
        .eq("room_id", roomId)
        .eq("role", "TABLE")
        .eq("connected", true)
        .limit(1);
      if (!cancelled && !error) setHasTableDevice((data?.length ?? 0) > 0);
    }

    void refresh();
    const channel = supabase
      .channel(`room:${roomId}:table-devices`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices", filter: `room_id=eq.${roomId}` }, () => void refresh())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  return hasTableDevice;
}
