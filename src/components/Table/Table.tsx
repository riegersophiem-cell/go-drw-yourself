import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { PublicGameState, PublicPlayerView } from "../../game/types";
import { AVATAR_IMAGE } from "../../game/avatarImages";
import { Card } from "../Card/Card";
import { TurnPlayback } from "../TurnPlayback/TurnPlayback";
import type { PlaybackBeat } from "../../multiplayer/playbackBeats";
import "./Table.css";

const CROWDED_PLAYER_THRESHOLD = 7;

export interface TableProps {
  publicState: PublicGameState;
  compact?: boolean;
  ownPlayerId?: string;
  playback?: { beat: PlaybackBeat; position: number; total: number; canSkip: boolean; onSkip: () => void; active: boolean } | null;
  canRemovePlayers?: boolean;
  removingPlayerId?: string | null;
  onRemovePlayer?: (playerId: string) => void;
}

/**
 * The 3/4-seat side positions sit level with the hero/direction row (their
 * "frame the center" job per the brief). Below 760px the center-grid itself
 * shrinks (see Table.css/Card.css mobile rules) specifically to leave room
 * for these seats at nearly the same row without hitting the direction orb,
 * the hero pile, or the status rail below — confirmed clear via measured
 * DOM rects at 375px, the narrowest required target.
 */
function seatStyle(index: number, count: number): CSSProperties {
  const narrow = typeof window !== "undefined" && window.innerWidth <= 760;
  if (count <= 1) return { left: "50%", top: "9%" };
  if (count === 3) {
    /* Narrow: side seats sit in the ~54px gap between the own-player card
       and the center-grid (measured via DOM rects at 375px) rather than
       level with the hero row, which is where they collided with the draw
       pile and its caption. 28.6% lands them centered in that gap with a
       few px of clearance on both sides. */
    /* Desktop: pulled a bit further out (91/9 instead of 83/17) than the
       original delivery — at 768-900px widths (the surface is still full
       width there, the center-grid only shrinks below 760px) the closer-in
       anchors let these seats overlap the draw pile, confirmed via measured
       DOM rects at 768px. Still clear of everything at 1920/1366 (checked),
       just with a bit more margin than before. */
    const seats = narrow ? [[50, 8], [84, 27], [16, 27]] : [[50, 10], [91, 55], [9, 55]];
    return { left: `${seats[index][0]}%`, top: `${seats[index][1]}%` };
  }
  if (count === 4) {
    const seats = narrow ? [[50, 8], [84, 42], [84, 76], [16, 58]] : [[50, 10], [91, 38], [91, 90], [9, 55]];
    return { left: `${seats[index][0]}%`, top: `${seats[index][1]}%` };
  }
  const angle = -90 + (360 / count) * index;
  const rad = (angle * Math.PI) / 180;
  return { left: `${50 + 43 * Math.cos(rad)}%`, top: `${50 + 37 * Math.sin(rad)}%` };
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function useNarrowTable(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(max-width: 760px)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(max-width: 760px)").matches,
    () => false,
  );
}

function effectLabel(publicState: PublicGameState): string {
  if (publicState.pendingEffect?.type === "DRAW_STACK") return `+${publicState.pendingEffect.amount}`;
  if (publicState.phase === "WAITING_FOR_COLOR") return "Farbe wählen";
  if (publicState.phase === "WAITING_FOR_SWAP_TARGET") return "Tauschziel";
  if (publicState.phase === "WAITING_FOR_SKIP_TARGET") return "Aussetzen";
  if (publicState.phase === "WAITING_FOR_EXTRA_DISCARD") return "Zusatzkarte";
  return "Keiner";
}

function useHandShufflePulse(publicState: PublicGameState): boolean {
  const [pulsing, setPulsing] = useState(false);
  const lastVersion = useRef<number | null>(null);
  useEffect(() => {
    if (lastVersion.current === publicState.version) return;
    const isShuffle = publicState.topDiscard?.type === "ROTATE_HANDS" || publicState.topDiscard?.type === "SWAP_HAND";
    lastVersion.current = publicState.version;
    if (!isShuffle) return;
    setPulsing(true);
    const timeout = setTimeout(() => setPulsing(false), 900);
    return () => clearTimeout(timeout);
  }, [publicState.version, publicState.topDiscard?.type]);
  return pulsing;
}

export function Table({ publicState, compact = false, ownPlayerId, playback, canRemovePlayers = false, removingPlayerId, onRemovePlayer }: TableProps) {
  const currentPlayer = publicState.players.find((player) => player.playerId === publicState.currentPlayerId);
  const shufflePulse = useHandShufflePulse(publicState);
  const narrow = useNarrowTable();
  /* 4-6 players still fit the absolute per-seat layout at desktop widths, but
     at 375-760px there isn't enough clear width beside the center-grid for
     more than the two seats the 3-player case uses (see seatStyle above) —
     the flex-wrap "crowded" layout used for 7+ players sidesteps the
     collision entirely, so mobile widths opt into it a bit earlier. Own
     player still stands out there via its light card background and the
     "DEIN ZUG" pill, just without the dedicated top-center slot. */
  const seatedPlayers = useMemo(() => publicState.players.filter((player) => !player.eliminated), [publicState.players]);
  const crowded = seatedPlayers.length >= CROWDED_PLAYER_THRESHOLD || narrow;
  const orderedPlayers = useMemo(() => {
    const ownIndex = ownPlayerId ? seatedPlayers.findIndex((player) => player.playerId === ownPlayerId) : -1;
    return ownIndex > 0 ? [...seatedPlayers.slice(ownIndex), ...seatedPlayers.slice(0, ownIndex)] : seatedPlayers;
  }, [ownPlayerId, seatedPlayers]);

  function renderPlayer(player: PublicPlayerView, seatIndex: number | null) {
    const isActive = player.playerId === publicState.currentPlayerId;
    const isOwn = player.playerId === ownPlayerId;
    const disconnected = !player.connected && player.type === "HUMAN";
    return (
      <article key={player.playerId} className={`table-board__player ${crowded ? "table-board__player--crowded" : ""} ${isActive ? "table-board__player--active" : ""} ${isOwn ? "table-board__player--own" : ""} ${!isOwn && seatIndex !== null ? "table-board__player--side" : ""} ${shufflePulse ? "table-board__player--pulse" : ""} ${playback?.active && playback.beat.actorPlayerId === player.playerId ? "table-board__player--playback-actor" : ""} ${playback?.active && playback.beat.targetPlayerId === player.playerId ? "table-board__player--playback-target" : ""}`} style={seatIndex === null ? undefined : seatStyle(seatIndex, orderedPlayers.length)} title={`${player.displayName} – ${player.cardCount} Karten`}>
        <div className={`table-board__avatar ${player.type === "BOT" ? "table-board__avatar--bot" : ""} ${AVATAR_IMAGE[player.avatar] ? "" : "table-board__avatar--fallback"}`} aria-hidden="true">
          {AVATAR_IMAGE[player.avatar] ? <img className="table-board__avatar-img" src={AVATAR_IMAGE[player.avatar]} alt="" /> : initials(player.displayName)}
          <span className={`table-board__presence ${disconnected ? "table-board__presence--offline" : ""}`} />
        </div>
        <div className="table-board__player-copy">
          <strong className="table-board__player-name">{player.displayName}</strong>
          <span className="table-board__player-count">{player.type === "BOT" ? "BOT" : "SPIELER"} · {player.cardCount} Karten</span>
        </div>
        {isActive && <span className="table-board__turn-pill">{isOwn ? "DEIN ZUG" : "AM ZUG"}</span>}
        {publicState.pendingSkipTargets[player.playerId] > 0 && <span className="table-board__skip-stamp">AUSGESETZT</span>}
        {canRemovePlayers && !isOwn && <button className="table-board__remove-player" type="button" disabled={!!removingPlayerId} onClick={() => onRemovePlayer?.(player.playerId)} aria-label={`${player.displayName} entfernen`}>{removingPlayerId === player.playerId ? "…" : "×"}</button>}
      </article>
    );
  }

  return (
    <section className={`table-board ${compact ? "table-board--compact" : ""} ${playback?.active ? `table-board--playback table-board--playback-${playback.beat.kind.toLowerCase()}` : ""}`} aria-label="Spieltisch">
      <div className="table-board__surface">
        <div className="table-board__rings" aria-hidden="true" />
        {crowded ? <div className="table-board__crowded-seats">{orderedPlayers.map((player) => renderPlayer(player, null))}</div> : orderedPlayers.map((player, index) => renderPlayer(player, index))}

        <div className={`table-board__center-stage ${shufflePulse ? "table-board__center-stage--pulse" : ""}`}>
          {publicState.pendingEffect?.type === "DRAW_STACK" && (
            <div className="table-board__effect-chip"><span aria-hidden="true">▰</span><span><small>DRAW STACK</small>Nächster Spieler zieht {publicState.pendingEffect.amount} Karten</span><strong>+{publicState.pendingEffect.amount}</strong></div>
          )}
          <div className="table-board__center-grid">
            <div className="table-board__pile table-board__pile--draw">
              <div className="table-board__card-stack table-board__card-stack--draw"><Card def={{ defId: "back", color: "WILD", type: "WILD" }} faceDown size={compact ? "table" : "normal"} /></div>
              <strong>Ziehstapel</strong><span>{publicState.drawPileCount}</span>
            </div>
            <div className="table-board__pile table-board__pile--discard">
              <div className="table-board__hero-halo" />
              <div className="table-board__card-stack table-board__card-stack--hero">
                {publicState.topDiscard ? <Card def={publicState.topDiscard} size="hero" display /> : <div className="uno-card uno-card--hero" />}
              </div>
              <strong>Ablagestapel</strong>
              {publicState.activeColor && <span className={`table-board__active-color table-board__active-color--${publicState.activeColor}`} />}
            </div>
            <div className="table-board__direction">
              <small>Spielrichtung</small>
              <div className="table-board__direction-orb" aria-label={publicState.direction === 1 ? "Im Uhrzeigersinn" : "Gegen den Uhrzeigersinn"}>{publicState.direction === 1 ? "↻" : "↺"}</div>
              <strong>{publicState.direction === 1 ? "Im Uhrzeigersinn" : "Gegen den Uhrzeigersinn"}</strong>
            </div>
          </div>
          <div className="table-board__status-rail">
            <div><span aria-hidden="true">↪</span><small>Letzter Zug</small><strong>{publicState.topDiscard?.type.replaceAll("_", " ") ?? "Start"}</strong></div>
            <div><span aria-hidden="true">▱</span><small>Aktiver Effekt</small><strong>{effectLabel(publicState)}</strong></div>
            <div><span aria-hidden="true">●</span><small>Nächster Spieler</small><strong>{currentPlayer?.displayName ?? "–"}</strong></div>
          </div>
        </div>
      </div>
      {playback && <TurnPlayback key={`${playback.beat.id}:${playback.active}`} beat={playback.beat} players={publicState.players} position={playback.position} total={playback.total} canSkip={playback.canSkip} onSkip={playback.onSkip} active={playback.active} />}
    </section>
  );
}
