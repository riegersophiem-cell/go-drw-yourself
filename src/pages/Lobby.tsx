import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePendingAction } from "../hooks/usePendingAction";
import { addBot, leaveRoom, removePlayer, startGame } from "../multiplayer/api";
import { clearSession, type DeviceSession } from "../multiplayer/session";
import { useRoomRealtime } from "../hooks/useRoomRealtime";
import { AVATAR_IMAGE } from "../game/avatarImages";
import { useIsRoomHost } from "../hooks/useIsRoomHost";
import { useHasTableDevice } from "../hooks/useHasTableDevice";
import { buildInviteShareData, buildInviteText } from "../multiplayer/invite";
import { ThemeSwitch } from "../theme/ThemeSwitch";

/** Client-side mirror of the (prepared but not yet deployed) server-side cap in join-room/add-bot — see LOBBY_SESSION_FLOW_REPORT.md. */
const MAX_PLAYERS = 8;

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
  const { isHost: liveIsHost, hostDeviceId } = useIsRoomHost(session);
  const isHost = initialIsHost === true || liveIsHost;
  // Host visibility before Start (brief section 15/18/38): the host needs to
  // know a physical table screen is actually connected before pressing
  // "Spiel starten" — previously this hook was wired only into the in-game
  // PlayerGame view, so a host could start a presence game with zero table
  // devices connected and nobody in the lobby was ever told.
  const hasTableDevice = useHasTableDevice(session.roomId);
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
      <div className="page__theme-switch"><ThemeSwitch /></div>
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
                {p.device_id && p.device_id === hostDeviceId && <span className="lobby-player-list__badge lobby-player-list__badge--host">HOST</span>}
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
        </ul>

        {/* Table device gets its own compact block, never mixed into the
            player list as a regular row (brief section 14/38: "Table Device
            nicht wie normaler Spieler darstellen"). Shown to everyone, not
            just the host, so any device in the room can see whether a
            presence table is available. */}
        <div className={`lobby-table-device ${hasTableDevice ? "lobby-table-device--connected" : ""}`}>
          <span className="lobby-table-device__icon" aria-hidden="true">🃏</span>
          <span className="lobby-table-device__copy">
            <strong>Tischgerät</strong>
            <span>{hasTableDevice ? "Verbunden — Präsenzmodus möglich" : "Kein Tischgerät — alle spielen remote"}</span>
          </span>
          {session.role !== "PLAYER" && (
            <span className="lobby-table-device__self">{session.role === "TABLE" ? "Dieses Gerät" : "👁 Zuschauer"}</span>
          )}
        </div>

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
            {/* MAX_PLAYERS mirrors the (currently client-only — see
                LOBBY_SESSION_FLOW_REPORT.md, server-side enforcement is
                prepared but not deployed) room-size assumption used
                elsewhere. Disabling here at least gives immediate feedback
                instead of a failed request once the cap is hit. */}
            <button className="btn btn--secondary" onClick={handleAddBot} disabled={busy || players.length >= MAX_PLAYERS}>
              Bot hinzufügen
            </button>
            <button className="btn btn--primary" onClick={() => void handleStart()} disabled={busy || players.length < 2}>
              Spiel starten
            </button>
            {players.length < 2 && <p className="field-label">Mindestens 2 Spieler nötig.</p>}
            {players.length >= MAX_PLAYERS && <p className="field-label">Raum ist voll ({MAX_PLAYERS} Spieler).</p>}
          </>
        )}
        {!isHost && <p className="field-label">Warte, bis der Host das Spiel startet…</p>}
        <button className="btn btn--secondary" onClick={() => void handleLeave()} disabled={busy}>Raum verlassen</button>
      </div>
    </div>
  );
}
