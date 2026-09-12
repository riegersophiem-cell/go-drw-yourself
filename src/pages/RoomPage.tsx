import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";
import { reconnect } from "../multiplayer/api";
import { loadSession, type DeviceSession } from "../multiplayer/session";
import { shouldApplyStatusReconciliation } from "../multiplayer/statusReconciliation";
import { supabase } from "../supabase/client";
import { Lobby } from "./Lobby";
import { PlayerGame } from "./PlayerGame";
import { TableGame } from "./TableGame";

type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";

/**
 * Passed via `navigate(path, { state })` by Home/Join right after a
 * successful createRoom()/joinRoom() call, so the room page they land on
 * doesn't need to re-fetch what the server just confirmed. Only ever built
 * from values the server response itself guarantees for that exact
 * action/role (see Home.tsx/Join.tsx) — never a guess.
 */
export interface RoomNavState {
  roomId: string;
  deviceId: string;
  confirmedStatus: "LOBBY";
  isHost?: boolean;
}

function isRoomNavState(value: unknown): value is RoomNavState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.roomId === "string" && typeof v.deviceId === "string" && v.confirmedStatus === "LOBBY" && (v.isHost === undefined || typeof v.isHost === "boolean");
}

export function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [session, setSession] = useState<DeviceSession | null>(null);
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [initialIsHost, setInitialIsHost] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bumped on every authoritative status update (a realtime event, or the
  // background reconciliation below applying its result) so a stale async
  // read can tell it's been superseded. See shouldApplyStatusReconciliation.
  const statusVersionRef = useRef(0);
  // Set only when this mount took the skip-reconnect path, so the
  // subscription effect knows whether a one-shot background reconciliation
  // is owed once realtime is confirmed live. Reset per mount/roomId change.
  const needsReconciliationRef = useRef(false);

  useEffect(() => {
    const stored = loadSession();
    if (!stored || stored.roomId !== roomId) {
      navigate("/join");
      return;
    }
    setSession(stored);

    // Only a genuine same-tab forward navigation (PUSH/REPLACE, i.e. the
    // navigate() call Home/Join just made) can carry trustworthy nav state.
    // Browser back/forward (POP) must always re-verify against the server —
    // the room's real status may have moved on since that history entry was
    // created, and a stale cached "LOBBY" must never win over that.
    const navState = location.state;
    const canSkipReconnect = navigationType !== "POP" && isRoomNavState(navState) && navState.roomId === roomId && navState.deviceId === stored.deviceId;

    if (canSkipReconnect) {
      needsReconciliationRef.current = true;
      statusVersionRef.current++;
      setStatus(navState.confirmedStatus);
      setInitialIsHost(navState.isHost);
      setLoading(false);
      return;
    }

    needsReconciliationRef.current = false;
    reconnect(stored.deviceId, stored.sessionToken)
      .then((res) => {
        statusVersionRef.current++;
        setStatus(res.roomStatus as RoomStatus);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [roomId, navigate, location.state, navigationType]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const thisRoomId = roomId;

    const channel = supabase
      .channel(`room:${roomId}:rooms-table`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (cancelled) return;
        statusVersionRef.current++;
        setStatus((payload.new as { status: RoomStatus }).status);
      })
      .subscribe((subStatus) => {
        if (subStatus !== "SUBSCRIBED" || cancelled || !needsReconciliationRef.current) return;
        // One-shot: only reconcile once per skip-reconnect mount, right
        // after realtime is confirmed live — not on every reconnect of the
        // realtime client.
        needsReconciliationRef.current = false;

        const versionAtRequestStart = statusVersionRef.current;
        Promise.resolve(supabase.from("rooms").select("status").eq("room_id", thisRoomId).maybeSingle())
          .then(({ data }) => {
            if (!data?.status) return;
            const canApply = shouldApplyStatusReconciliation({
              versionAtRequestStart,
              currentVersion: statusVersionRef.current,
              requestRoomId: thisRoomId,
              currentRoomId: roomId,
              cancelled,
            });
            if (!canApply) return;
            statusVersionRef.current++;
            setStatus(data.status as RoomStatus);
          })
          .catch(() => {
            // Best-effort safety net only — the realtime subscription and,
            // on the next real reload, reconnect() remain the sources of
            // truth, so a failed reconciliation read is not surfaced as an
            // error.
          });
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (loading) return <div className="page page--centered">Verbinde…</div>;
  if (error) return <div className="page page--centered error-text">{error}</div>;
  if (!session || !roomId || !status) return null;

  if (status === "LOBBY") return <Lobby session={session} initialIsHost={initialIsHost} />;
  if (session.role === "PLAYER" && session.playerId) return <PlayerGame session={session} />;
  return <TableGame session={session} />;
}
