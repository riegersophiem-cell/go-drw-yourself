import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePendingAction } from "../hooks/usePendingAction";
import { addBot, leaveRoom, removePlayer, startGame } from "../multiplayer/api";
import { clearSession, type DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { AVATAR_IMAGE } from "../game/avatarImages";
import { useIsRoomHost } from "../hooks/useIsRoomHost";
import { buildInviteShareData, buildInviteText } from "../multiplayer/invite";

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
  const navigate = useNavigate();
  const { players } = useRoomRealtime(session.roomId);
  const liveIsHost = useIsRoomHost(session);
  const isHost = initialIsHost === true || liveIsHost;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const pendingStart = usePendingAction<{ type: "START_GAME" }>();

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

  async function handleRemovePlayer(playerId: string) {
    const player = players.find((candidate) => candidate.player_id === playerId);
    if (!player || !window.confirm(`${player.display_name} wirklich aus dem Raum entfernen?`)) return;
    setBusy(true);
    setError(null);
    try {
      await removePlayer(session.deviceId, session.sessionToken, playerId, { actionId: crypto.randomUUID(), expectedGameId: null, expectedVersion: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!window.confirm(isHost ? "Raum wirklich verlassen? Die Hostrolle geht an den nächsten Spieler." : "Raum wirklich verlassen?")) return;
    setBusy(true); setError(null);
    try {
      await leaveRoom(session.deviceId, session.sessionToken, { actionId: crypto.randomUUID(), expectedGameId: null, expectedVersion: null });
      clearSession();
      navigate("/");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
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

  async function copyInvitation() {
    const text = buildInviteText(joinUrl);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("COPY_FAILED");
    }
    setInviteStatus("Einladungstext und Raumlink kopiert.");
  }

  async function handleInvite() {
    setInviteStatus(null);
    if (navigator.share) {
      try {
        await navigator.share(buildInviteShareData(joinUrl));
        setInviteStatus("Einladung geteilt.");
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }

    try {
      await copyInvitation();
    } catch {
      setInviteStatus("Kopieren fehlgeschlagen. Nutze bitte den angezeigten Raumlink.");
    }
  }

  return (
    <div className="page page--centered">
      <h1 className="brand-title">Raum {session.roomCode}</h1>
      <div className="panel panel--wide">
        <div className="lobby-invite">
          <p className="field-label">Beitreten unter: <span className="lobby-invite__url">{joinUrl}</span></p>
          <button className="btn btn--primary lobby-invite__button" onClick={() => void handleInvite()}>
            Spieler einladen
          </button>
          {inviteStatus && <p className="lobby-invite__status" role="status" aria-live="polite">{inviteStatus}</p>}
        </div>

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
                ) : "Bot"}
                {isHost && p.player_id !== session.playerId && (
                  <button className="lobby-player-list__remove" onClick={() => handleRemovePlayer(p.player_id)} disabled={busy}>
                    Entfernen
                  </button>
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
        <button className="btn btn--secondary" onClick={() => void handleLeave()} disabled={busy}>Raum verlassen</button>
      </div>
    </div>
  );
}
