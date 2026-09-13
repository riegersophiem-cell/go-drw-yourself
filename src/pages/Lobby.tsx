import { useEffect, useState } from "react";
import { usePendingAction } from "../hooks/usePendingAction";
import { addBot, removeBot, startGame } from "../multiplayer/api";
import type { DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { supabase } from "../supabase/client";
import { AVATAR_IMAGE } from "../game/avatarImages";

export interface LobbyProps {
  session: DeviceSession;
  /**
   * Seeds the host check when the caller already knows the answer for
   * certain (RoomPage passes this through only from server-confirmed nav
   * state, e.g. createRoom() always makes the creating device the host —
   * see RoomNavState in RoomPage.tsx). Avoids a frame of the wrong
   * "Warte, bis der Host…" copy while the query below is still in flight.
   * The query still runs regardless, so a wrong or absent value self-corrects.
   */
  initialIsHost?: boolean;
}

export function Lobby({ session, initialIsHost }: LobbyProps) {
  const { players } = useRoomRealtime(session.roomId);
  const [isHost, setIsHost] = useState(initialIsHost ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingStart = usePendingAction<{ type: "START_GAME" }>();

  useEffect(() => {
    supabase
      .from("rooms")
      .select("host_device_id")
      .eq("room_id", session.roomId)
      .single()
      .then(({ data }) => setIsHost(data?.host_device_id === session.deviceId));
  }, [session.roomId, session.deviceId]);

  async function handleAddBot() {
    setBusy(true);
    setError(null);
    try {
      await addBot(session.deviceId, session.sessionToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveBot(botPlayerId: string) {
    setBusy(true);
    setError(null);
    try {
      await removeBot(session.deviceId, session.sessionToken, botPlayerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleStart(retry = false) {
    const action = { type: "START_GAME" } as const;
    const pending = pendingStart.begin(action, retry);
    setBusy(true);
    setError(null);
    try {
      await startGame(session.deviceId, session.sessionToken, {
        actionId: pending.actionId,
        expectedGameId: null,
        expectedVersion: null,
      });
      pendingStart.complete(pending.actionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const joinUrl = `${window.location.origin}/join/${session.roomCode}`;

  return (
    <div className="page page--centered">
      <h1 className="brand-title">Raum {session.roomCode}</h1>
      <div className="panel panel--wide">
        <p className="field-label">Beitreten unter: {joinUrl}</p>

        <ul className="lobby-player-list">
          {players.map((p) => (
            <li key={p.player_id}>
              <span className="lobby-player-list__identity">
                {AVATAR_IMAGE[p.avatar] ? <img className="lobby-player-list__avatar" src={AVATAR_IMAGE[p.avatar]} alt="" /> : "👤"}
                {p.display_name}
              </span>
              <span className="lobby-player-list__status">
                {p.player_type === "HUMAN" ? (
                  p.connected ? (
                    "verbunden"
                  ) : (
                    "getrennt"
                  )
                ) : isHost ? (
                  <button className="lobby-player-list__remove" onClick={() => handleRemoveBot(p.player_id)} disabled={busy}>
                    Entfernen
                  </button>
                ) : (
                  "Bot"
                )}
              </span>
            </li>
          ))}
          {session.role !== "PLAYER" && <li>{session.role === "TABLE" ? "🃏 Dieses Gerät: Spieltisch" : "👁 Dieses Gerät: Zuschauer"}</li>}
        </ul>

        {error && (
          <div>
            <p className="error-text">{error}</p>
            {pendingStart.pending && (
              <>
                <button className="btn btn--secondary" onClick={() => void handleStart(true)} disabled={busy}>Erneut versuchen</button>
                <button className="btn btn--secondary" onClick={() => { pendingStart.cancel(); setError(null); }} disabled={busy}>Abbrechen</button>
              </>
            )}
          </div>
        )}

        {isHost && (
          <>
            <button className="btn btn--secondary" onClick={handleAddBot} disabled={busy}>
              Bot hinzufügen
            </button>
            <button className="btn btn--primary" onClick={() => void handleStart()} disabled={busy || players.length < 2}>
              Spiel starten
            </button>
            {players.length < 2 && <p className="field-label">Mindestens 2 Spieler nötig.</p>}
          </>
        )}
        {!isHost && <p className="field-label">Warte, bis der Host das Spiel startet…</p>}
      </div>
    </div>
  );
}
