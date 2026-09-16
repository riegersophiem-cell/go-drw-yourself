// DEV-ONLY deterministic Lobby QA harness — same pattern as ActionPreview.tsx
// / MobilePreview.tsx (see App.tsx: import.meta.env.DEV-gated lazy route,
// fully dead-code-eliminated from a production build). Renders the exact
// same App.css classes/markup structure the real Lobby.tsx uses, against
// static mock player/table-device data, so states that are awkward or
// impossible to reach through a real Supabase room (a player stuck
// "disconnected" mid-lobby, 6+ bots at once, a specific mobile width) can be
// reproduced instantly for screenshotting. See LOBBY_SESSION_FLOW_REPORT.md.
import { useSearchParams } from "react-router-dom";
import { AVATAR_IMAGE } from "../../game/avatarImages";
import type { AvatarId } from "../../game/avatars";

interface MockPlayer {
  player_id: string;
  display_name: string;
  player_type: "HUMAN" | "BOT";
  avatar: AvatarId;
  connected: boolean;
  isHost: boolean;
}

const AVATARS: AvatarId[] = ["H01", "H02", "H03", "BOT1", "BOT2", "BOT3", "BOT4", "BOT5"];

function makePlayers(humanCount: number, botCount: number, disconnectedIndex: number | null): MockPlayer[] {
  const players: MockPlayer[] = [];
  for (let i = 0; i < humanCount; i++) {
    players.push({ player_id: `h${i}`, display_name: i === 0 ? "Sophie" : `Spieler ${i + 1}`, player_type: "HUMAN", avatar: AVATARS[i % 3], connected: i !== disconnectedIndex, isHost: i === 0 });
  }
  for (let i = 0; i < botCount; i++) {
    players.push({ player_id: `b${i}`, display_name: `Bot ${i + 1}`, player_type: "BOT", avatar: AVATARS[3 + (i % 5)], connected: true, isHost: false });
  }
  return players;
}

export function LobbyPreview() {
  const [params] = useSearchParams();
  const humans = Math.min(6, Math.max(1, Number(params.get("humans") ?? 2)));
  const bots = Math.min(6, Math.max(0, Number(params.get("bots") ?? 0)));
  const hasTableDevice = params.get("table") === "1";
  const isHost = params.get("host") !== "0";
  const disconnectedIndex = params.get("disconnected") === "1" ? 1 : null;
  const roomCode = "QA01XY";

  const players = makePlayers(humans, bots, disconnectedIndex);
  const joinUrl = `http://localhost:5173/join/${roomCode}`;

  return (
    <div className="page page--centered">
      <h1 className="brand-title">Raum {roomCode}</h1>
      <div className="panel panel--wide">
        <div className="lobby-invite">
          <p className="field-label">Beitreten unter: <span className="lobby-invite__url">{joinUrl}</span></p>
          <button className="btn btn--primary lobby-invite__button" type="button">Spieler einladen</button>
        </div>

        <ul className="lobby-player-list">
          {players.map((p) => (
            <li key={p.player_id}>
              <span className="lobby-player-list__identity">
                {AVATAR_IMAGE[p.avatar] ? <img className="lobby-player-list__avatar" src={AVATAR_IMAGE[p.avatar]} alt="" /> : "👤"}
                {p.display_name}
                {p.isHost && <span className="lobby-player-list__badge lobby-player-list__badge--host">HOST</span>}
              </span>
              <span className="lobby-player-list__status">
                {p.player_type === "HUMAN" ? (p.connected ? "verbunden" : "getrennt") : "Bot"}
                {isHost && !p.isHost && (
                  <button className="lobby-player-list__remove" type="button">Entfernen</button>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className={`lobby-table-device ${hasTableDevice ? "lobby-table-device--connected" : ""}`}>
          <span className="lobby-table-device__icon" aria-hidden="true">🃏</span>
          <span className="lobby-table-device__copy">
            <strong>Tischgerät</strong>
            <span>{hasTableDevice ? "Verbunden — Präsenzmodus möglich" : "Kein Tischgerät — alle spielen remote"}</span>
          </span>
        </div>

        {isHost && (
          <>
            <button className="btn btn--secondary" type="button" disabled={players.length >= 8}>Bot hinzufügen</button>
            <button className="btn btn--primary" type="button" disabled={players.length < 2}>Spiel starten</button>
            {players.length < 2 && <p className="field-label">Mindestens 2 Spieler nötig.</p>}
          </>
        )}
        {!isHost && <p className="field-label">Warte, bis der Host das Spiel startet…</p>}
        <button className="btn btn--secondary" type="button">Raum verlassen</button>
      </div>
    </div>
  );
}
