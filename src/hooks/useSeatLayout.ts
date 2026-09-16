import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import { fetchSeatLayout, setSeatLayout } from "../multiplayer/api";

/** Live seat layout for a room (see supabase/migrations/0009_seat_layout.sql) — visual ring order only, never turn order. */
export function useSeatLayout(roomId: string) {
  const [seatOrder, setSeatOrderState] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const layout = await fetchSeatLayout(roomId).catch(() => null);
      if (!cancelled) setSeatOrderState(layout);
    }

    void refresh();
    const channel = supabase
      .channel(`room:${roomId}:seat-layout`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seat_layout", filter: `room_id=eq.${roomId}` }, () => void refresh())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId]);

  const updateSeatOrder = useCallback(
    async (deviceId: string, sessionToken: string, newOrder: string[]) => {
      setSeatOrderState(newOrder); // optimistic; realtime confirms/corrects
      await setSeatLayout(deviceId, sessionToken, roomId, newOrder);
    },
    [roomId],
  );

  return { seatOrder, updateSeatOrder };
}
