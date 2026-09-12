import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { nextRound } from "../../multiplayer/api";
import { clearSession, type DeviceSession } from "../../multiplayer/session";
import { supabase } from "../../supabase/client";
import type { RoomPlayerRow } from "../../hooks/useRoomRealtime";
import "./WinnerOverlay.css";

export interface WinnerOverlayProps {
  session: DeviceSession;
  winnerName: string;
  players: RoomPlayerRow[];
}

/**
 * The three post-round actions (brief §17-20) are kept deliberately
 * distinct: SPIEL VERLASSEN and NEUES SPIEL both leave this room for good
 * (session cleared), NÄCHSTE RUNDE reuses the same room/lobby/match score
 * and only deals a fresh round.
 */
export function WinnerOverlay({ session, winnerName, players }: WinnerOverlayProps) {
  const navigate = useNavigate();
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

  function handleLeave() {
    clearSession();
    navigate("/");
  }

  function handleNewGame() {
    clearSession();
    navigate("/");
  }

  async function handleNextRound() {
    setBusy(true);
    setError(null);
    try {
      await nextRound(session.deviceId, session.sessionToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const ranked = [...players].sort((a, b) => b.wins - a.wins);

  return (
    <div className="winner-overlay">
      <div className="winner-overlay__trophy">🏆</div>
      <div className="winner-overlay__name">{winnerName}</div>
      <div className="winner-overlay__caption">GEWINNT!</div>

      <div className="winner-overlay__scores">
        <p className="field-label">SPIELERGEBNIS</p>
        <ul>
          {ranked.map((p) => (
            <li key={p.player_id}>
              <span>
                {p.player_type === "BOT" ? "🤖 " : "👤 "}
                {p.display_name}
              </span>
              <span>
                {p.wins} {p.wins === 1 ? "Sieg" : "Siege"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="winner-overlay__actions">
        <button className="btn btn--secondary" onClick={handleLeave}>
          Spiel verlassen
        </button>
        {isHost ? (
          <button className="btn btn--primary" onClick={handleNextRound} disabled={busy}>
            Nächste Runde
          </button>
        ) : (
          <p className="field-label">Warte auf den Host für die nächste Runde…</p>
        )}
        <button className="btn btn--secondary" onClick={handleNewGame}>
          Neues Spiel erstellen
        </button>
      </div>
    </div>
  );
}
