import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { reconnect } from "../multiplayer/api";
import { loadSession, type DeviceSession } from "../multiplayer/session";
import { supabase } from "../supabase/client";
import { Lobby } from "./Lobby";
import { PlayerGame } from "./PlayerGame";
import { TableGame } from "./TableGame";

type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";

export function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadSession();
    if (!stored || stored.roomId !== roomId) {
      navigate("/join");
      return;
    }
    setSession(stored);

    reconnect(stored.deviceId, stored.sessionToken)
      .then((res) => setStatus(res.roomStatus as RoomStatus))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [roomId, navigate]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room:${roomId}:rooms-table`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `room_id=eq.${roomId}` }, (payload) => {
        setStatus((payload.new as { status: RoomStatus }).status);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (loading) return <div className="page page--centered">Verbinde…</div>;
  if (error) return <div className="page page--centered error-text">{error}</div>;
  if (!session || !roomId || !status) return null;

  if (status === "LOBBY") return <Lobby session={session} />;
  if (session.role === "PLAYER" && session.playerId) return <PlayerGame session={session} />;
  return <TableGame session={session} />;
}
