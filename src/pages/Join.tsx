import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { joinRoom } from "../multiplayer/api";
import { saveSession } from "../multiplayer/session";
import type { DeviceRole } from "../game/types";
import type { RoomNavState } from "./RoomPage";

const ROLE_OPTIONS: { role: DeviceRole; icon: string; title: string; subtitle: string }[] = [
  { role: "PLAYER", icon: "👤", title: "Spieler", subtitle: "Ich spiele selbst mit" },
  { role: "TABLE", icon: "🃏", title: "Spieltisch", subtitle: "Gemeinsames Display" },
  { role: "SPECTATOR", icon: "👁", title: "Zuschauer", subtitle: "Nur Spiel ansehen" },
];

export function Join() {
  const params = useParams();
  const [roomCode, setRoomCode] = useState(params.code?.toUpperCase() ?? "");
  const [name, setName] = useState("");
  const [role, setRole] = useState<DeviceRole | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleJoin() {
    if (!roomCode.trim()) return setError("Bitte gib einen Raum-Code ein.");
    if (!role) return setError("Bitte wähle, wie du beitreten möchtest.");
    if (role === "PLAYER" && !name.trim()) return setError("Bitte gib deinen Namen ein.");

    setBusy(true);
    setError(null);
    try {
      const result = await joinRoom(roomCode.trim().toUpperCase(), role, name.trim() || undefined);
      saveSession({
        roomId: result.roomId,
        roomCode: result.roomCode,
        deviceId: result.deviceId,
        sessionToken: result.sessionToken,
        role: result.role,
        playerId: result.playerId,
      });
      // join-room only guarantees status LOBBY for a PLAYER join (it rejects
      // PLAYER joins into a non-LOBBY room); TABLE/SPECTATOR may join a room
      // in any status, so its real status is genuinely unknown here and must
      // come from reconnect() on the room page instead of being assumed.
      const navState: RoomNavState | undefined =
        result.role === "PLAYER" ? { roomId: result.roomId, deviceId: result.deviceId, confirmedStatus: "LOBBY" } : undefined;
      navigate(`/room/${result.roomId}`, navState ? { state: navState } : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--centered">
      <h1 className="brand-title">Spiel beitreten</h1>
      <div className="panel">
        <label className="field-label" htmlFor="code">
          Raum-Code
        </label>
        <input
          id="code"
          className="text-input text-input--code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="AB7K2Q"
          maxLength={6}
        />

        {role === "PLAYER" && (
          <>
            <label className="field-label" htmlFor="name">
              Dein Name
            </label>
            <input id="name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Max" maxLength={24} />
          </>
        )}

        <p className="field-label">Wie möchtest du diesem Spiel beitreten?</p>
        <div className="role-grid">
          {ROLE_OPTIONS.map((opt) => (
            <button key={opt.role} type="button" className={`role-card ${role === opt.role ? "role-card--selected" : ""}`} onClick={() => setRole(opt.role)}>
              <span className="role-card__icon">{opt.icon}</span>
              <span className="role-card__title">{opt.title}</span>
              <span className="role-card__subtitle">{opt.subtitle}</span>
            </button>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}
        <button className="btn btn--primary" onClick={handleJoin} disabled={busy}>
          {busy ? "Trete bei…" : "Beitreten"}
        </button>
      </div>
    </div>
  );
}
