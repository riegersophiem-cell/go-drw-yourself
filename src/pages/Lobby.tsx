import { useEffect, useState } from "react";
import { addBot, removeBot, startGame } from "../multiplayer/api";
import type { DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { supabase } from "../supabase/client";

export interface LobbyProps {
  session: DeviceSession;
}

export function Lobby({ session }: LobbyProps) {
  const { players } = useRoomRealtime(session.roomId);
  const [isHost, setIsHost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      await startGame(session.deviceId, session.sessionToken);
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
              {p.player_type === "BOT" ? "🤖" : "👤"} {p.display_name}
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

        {error && <p className="error-text">{error}</p>}

        {isHost && (
          <>
            <button className="btn btn--secondary" onClick={handleAddBot} disabled={busy}>
              Bot hinzufügen
            </button>
            <button className="btn btn--primary" onClick={handleStart} disabled={busy || players.length < 2}>
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
