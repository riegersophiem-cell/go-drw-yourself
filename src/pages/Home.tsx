import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom } from "../multiplayer/api";
import { saveSession } from "../multiplayer/session";

export function Home() {
  const [name, setName] = useState("");
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
      const result = await createRoom(name.trim());
      saveSession({
        roomId: result.roomId,
        roomCode: result.roomCode,
        deviceId: result.deviceId,
        sessionToken: result.sessionToken,
        role: "PLAYER",
        playerId: result.playerId,
      });
      navigate(`/room/${result.roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--centered">
      <h1 className="brand-title">UNO Show 'Em<br />No Mercy</h1>
      <div className="panel">
        <label className="field-label" htmlFor="name">
          Dein Name
        </label>
        <input id="name" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sophie" maxLength={24} />
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
