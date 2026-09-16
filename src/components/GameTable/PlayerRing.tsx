import type { CSSProperties } from "react";
import type { PendingEffect, PublicPlayerView } from "../../game/types";
import { AVATAR_IMAGE } from "../../game/avatarImages";
import { computeFullRingSeatPoints, computeCompactRingSeatPoints } from "../../game/seatGeometry";
import "./PlayerRing.css";

export interface RingHighlight {
  actorPlayerId?: string | null;
  targetPlayerId?: string | null;
  kind?: "SWAP" | "ROTATE" | "SKIP" | "SKIP_ALL" | null;
}

export interface PlayerRingProps {
  players: PublicPlayerView[]; // already resolved into visual seat order by the caller
  currentPlayerId: string;
  ownPlayerId?: string;
  pendingSkipTargets: Record<string, number>;
  pendingEffect: PendingEffect;
  /** "full" = TABLE_DEVICE oval; "compact" = REMOTE_MOBILE_FULL's own (smaller) real ellipse — seats sit on the orbit, not in a flex-wrap strip above it. */
  variant?: "full" | "compact";
  /** The seat that will move after this one, in current turn direction — subtly pre-highlighted so the compact ring's turn arc has an obvious destination (MOBILE_HAND_UI_FIX_REPORT.md follow-up). */
  nextPlayerId?: string | null;
  highlight?: RingHighlight | null;
  seatEditMode?: boolean;
  seatEditSelectedId?: string | null;
  onSeatTap?: (playerId: string) => void;
  canRemovePlayers?: boolean;
  removingPlayerId?: string | null;
  onRemovePlayer?: (playerId: string) => void;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

/**
 * Which side of the Hero Center a seat sits on, so its avatar can lean
 * toward the table's middle instead of every seat using an identical
 * left-to-right layout (brief section 7). Whichever axis offset from center
 * dominates wins — this naturally covers every seat count without any
 * per-count special-casing.
 */
function seatOrientation(leftPct: number, topPct: number): "left" | "right" | "top" | "bottom" {
  const dx = leftPct - 50;
  const dy = topPct - 50;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "top" : "bottom";
}

/**
 * Renders players as seats around the table. TABLE_DEVICE gets a real oval
 * ring, positioned by pure ellipse math (computeSeatPoints) so every player
 * count from 2 up uses the exact same formula — no per-count hardcoding.
 * REMOTE_MOBILE_FULL gets a compact horizontal strip of the same player
 * cards instead of forcing the full oval into a phone-width band.
 */
export function PlayerRing({
  players,
  currentPlayerId,
  ownPlayerId,
  pendingSkipTargets,
  pendingEffect,
  variant = "full",
  nextPlayerId = null,
  highlight,
  seatEditMode = false,
  seatEditSelectedId,
  onSeatTap,
  canRemovePlayers = false,
  removingPlayerId,
  onRemovePlayer,
}: PlayerRingProps) {
  // Tighter than the seatGeometry default (43/37): pulls seats in closer to
  // the Hero Center so it can visually dominate instead of a wide, sparse
  // ring with a large dead gap in the middle (HERO_CENTER_FIX_REPORT.md).
  // Compact (mobile) uses its own, slightly tighter ellipse — a real oval,
  // not a flex-wrap strip, so seats visibly sit "on the table" the same way
  // TABLE_DEVICE's do (MOBILE_HAND_UI_FIX_REPORT.md follow-up).
  const seatPoints = variant === "full" ? computeFullRingSeatPoints(players.length) : computeCompactRingSeatPoints(players.length);

  function renderPlayer(player: PublicPlayerView, index: number) {
    const isActive = player.playerId === currentPlayerId;
    const isOwn = player.playerId === ownPlayerId;
    const disconnected = !player.connected && player.type === "HUMAN";
    const isSkipped = (pendingSkipTargets[player.playerId] ?? 0) > 0;
    const isDrawTarget = isActive && pendingEffect?.type === "DRAW_STACK";
    const isActorHighlight = highlight?.actorPlayerId === player.playerId;
    const isTargetHighlight = highlight?.targetPlayerId === player.playerId;
    // ROTATE moves every active hand at once — every unit gets a subtle
    // "participating" glow, not just actor/target (brief: "alle Spieler
    // sichtbar bleiben"). SKIP ALL dims everyone except the player who
    // stays at-turn, so the "everyone else sits out" reads instantly.
    // Extended to the compact (mobile) variant too, not just the full ring —
    // REMOTE_MOBILE_FULL has no ActionChoreography flight, so this dim/glow
    // highlight on the affected chips is the primary way a mobile action
    // reads as understandable without full choreography (MOBILE_HAND_UI_FIX_REPORT.md).
    const isRotateParticipant = highlight?.kind === "ROTATE";
    const isSkipAllDimmed = highlight?.kind === "SKIP_ALL" && highlight.actorPlayerId !== player.playerId;
    const isSeatSelected = seatEditSelectedId === player.playerId;
    const isNextUp = variant === "compact" && !isActive && nextPlayerId === player.playerId;
    const seatPoint = seatPoints[index];
    const style: CSSProperties | undefined =
      seatPoint ? { left: `${seatPoint.leftPct}%`, top: `${seatPoint.topPct}%` } : undefined;
    const orientation = variant === "full" && seatPoint ? seatOrientation(seatPoint.leftPct, seatPoint.topPct) : null;

    const avatar = (
      <div className={`player-unit__avatar ${player.type === "BOT" ? "player-unit__avatar--bot" : ""}`} aria-hidden="true">
        {AVATAR_IMAGE[player.avatar] ? <img src={AVATAR_IMAGE[player.avatar]} alt="" /> : initials(player.displayName)}
        <span className={`player-unit__presence ${disconnected ? "player-unit__presence--offline" : ""}`} />
      </div>
    );

    return (
      <article
        key={player.playerId}
        className={[
          variant === "full" ? "player-unit" : "player-ring__seat",
          variant === "full" ? `player-unit--${orientation}` : `player-ring__seat--${variant}`,
          isActive && (variant === "full" ? "player-unit--active" : "player-ring__seat--active"),
          isOwn && (variant === "full" ? "player-unit--own" : "player-ring__seat--own"),
          isSkipped && (variant === "full" ? "player-unit--skipped" : "player-ring__seat--skipped"),
          isDrawTarget && (variant === "full" ? "player-unit--draw-effect" : "player-ring__seat--draw-effect"),
          isActorHighlight && (variant === "full" ? "player-unit--highlight-actor" : "player-ring__seat--highlight-actor"),
          isTargetHighlight && (variant === "full" ? "player-unit--highlight-target" : "player-ring__seat--highlight-target"),
          isRotateParticipant && (variant === "full" ? "player-unit--rotate-participant" : "player-ring__seat--rotate-participant"),
          isSkipAllDimmed && (variant === "full" ? "player-unit--skip-all-dim" : "player-ring__seat--skip-all-dim"),
          seatEditMode && (variant === "full" ? "player-unit--editable" : "player-ring__seat--editable"),
          isSeatSelected && (variant === "full" ? "player-unit--seat-selected" : "player-ring__seat--seat-selected"),
          player.type === "BOT" && (variant === "full" ? "player-unit--bot" : "player-ring__seat--bot"),
          isNextUp && "player-ring__seat--next-up",
        ]
          .filter(Boolean)
          .join(" ")}
        style={style}
        data-player-id={player.playerId}
        title={`${player.displayName} – ${player.cardCount} Karten`}
        onClick={seatEditMode ? () => onSeatTap?.(player.playerId) : undefined}
        role={seatEditMode ? "button" : undefined}
      >
        {variant === "full" ? (
          <>
            {avatar}
            <div className="player-unit__pill">
              <strong className="player-unit__name">{player.displayName}</strong>
              <span className="player-unit__meta">{player.type === "BOT" ? "BOT" : "SPIELER"} · {player.cardCount}</span>
            </div>
            {isActive && <span className="player-unit__turn-badge">{isOwn ? "DEIN ZUG" : "AM ZUG"}</span>}
            {isSkipped && <span className="player-unit__badge player-unit__badge--skip" title={`TIMEOUT ×${pendingSkipTargets[player.playerId]}`} aria-label={`TIMEOUT mal ${pendingSkipTargets[player.playerId]}`}>⏭ ×{pendingSkipTargets[player.playerId]}</span>}
            {isDrawTarget && <span className="player-unit__badge player-unit__badge--draw">+{pendingEffect?.type === "DRAW_STACK" ? pendingEffect.amount : ""}</span>}
            {canRemovePlayers && !isOwn && (
              <button
                className="player-unit__remove"
                type="button"
                disabled={!!removingPlayerId}
                onClick={(e) => { e.stopPropagation(); onRemovePlayer?.(player.playerId); }}
                aria-label={`${player.displayName} entfernen`}
              >
                {removingPlayerId === player.playerId ? "…" : "×"}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="player-ring__avatar-wrap">
              <div className={`player-ring__avatar ${player.type === "BOT" ? "player-ring__avatar--bot" : ""}`} aria-hidden="true">
                {AVATAR_IMAGE[player.avatar] ? <img src={AVATAR_IMAGE[player.avatar]} alt="" /> : initials(player.displayName)}
                <span className={`player-ring__presence ${disconnected ? "player-ring__presence--offline" : ""}`} />
              </div>
              {isSkipped && <span className="player-ring__badge player-ring__badge--skip" title={`TIMEOUT ×${pendingSkipTargets[player.playerId]}`}>⏭×{pendingSkipTargets[player.playerId]}</span>}
              {isDrawTarget && <span className="player-ring__badge player-ring__badge--draw">+{pendingEffect?.type === "DRAW_STACK" ? pendingEffect.amount : ""}</span>}
              {canRemovePlayers && !isOwn && (
                <button
                  className="player-ring__remove"
                  type="button"
                  disabled={!!removingPlayerId}
                  onClick={(e) => { e.stopPropagation(); onRemovePlayer?.(player.playerId); }}
                  aria-label={`${player.displayName} entfernen`}
                >
                  {removingPlayerId === player.playerId ? "…" : "×"}
                </button>
              )}
            </div>
            <div className="player-ring__copy">
              <strong className="player-ring__name">{player.displayName}</strong>
              <span className="player-ring__count">{player.cardCount}</span>
            </div>
          </>
        )}
      </article>
    );
  }

  return (
    <div className={`player-ring player-ring--${variant} ${seatEditMode ? "player-ring--edit-mode" : ""}`}>
      {players.map((player, index) => renderPlayer(player, index))}
    </div>
  );
}
