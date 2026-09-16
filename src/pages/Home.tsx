import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../multiplayer/api";
import { saveSession } from "../multiplayer/session";
import { AvatarPicker } from "../components/AvatarPicker/AvatarPicker";
import { DEFAULT_HUMAN_AVATAR } from "../game/avatars";
import { ThemeSwitch } from "../theme/ThemeSwitch";
import type { RoomNavState } from "./RoomPage";

export function Home() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(DEFAULT_HUMAN_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleCreate() {
    if (!name.trim()) {
      setError("Bitte gib deinen Namen ein.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createRoom(name.trim(), avatar);
      saveSession({
        roomId: result.roomId,
        roomCode: result.roomCode,
        deviceId: result.deviceId,
        sessionToken: result.sessionToken,
        role: "PLAYER",
        playerId: result.playerId,
      });
      // create-room always inserts the room with status LOBBY and makes the
      // creating device its host — both guaranteed by the server, not guessed.
      const navState: RoomNavState = { roomId: result.roomId, deviceId: result.deviceId, confirmedStatus: "LOBBY", isHost: true };
      navigate(`/room/${result.roomId}`, { state: navState });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--centered">
      <div className="page__theme-switch"><ThemeSwitch /></div>
      <h1 className="brand-title brand-title--hero">
        GO DR<span className="brand-title__censor">*</span>W
        <br />
        YOURSELF
      </h1>
      <p className="brand-tagline">Swap it. Stack it. Make it someone else's problem.</p>
      <div className="panel">
        <label className="field-label" htmlFor="name">
          Dein Name
        </label>
        <input id="name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sophie" maxLength={24} />
        <p className="field-label">Dein Avatar</p>
        <AvatarPicker value={avatar} onChange={setAvatar} />
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn--primary" onClick={handleCreate} disabled={busy}>
          {busy ? "Erstelle Raum…" : "Neues Spiel"}
        </button>
        <button className="btn btn--secondary" onClick={() => navigate("/join")}>
          Einem Spiel beitreten
        </button>
      </div>
    </div>
  );
}
