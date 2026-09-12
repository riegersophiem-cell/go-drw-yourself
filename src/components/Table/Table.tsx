import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicGameState, PublicPlayerView } from "../../game/types";
import { Card } from "../Card/Card";
import "./Table.css";

/**
 * Above this many seats, the ellipse (seatStyle below) can no longer keep
 * adjacent badges from touching on a short landscape viewport no matter how
 * far their width/radius is trimmed — see Table.css's
 * `.table-board__surface--crowded` for the fallback layout. 2 and 4 players
 * always keep the ellipse; this threshold is the smallest count at which the
 * measured overlap actually occurred (6 and 8 both did, 4 never did).
 */
const CROWDED_PLAYER_THRESHOLD = 6;

export interface TableProps {
  publicState: PublicGameState;
  /** Embedded above a player's own hand instead of filling the whole screen. */
  compact?: boolean;
  /** Highlights this player's own row in the player list (compact mode). */
  ownPlayerId?: string;
}

/** Places a player badge on an ellipse around the table, seat 0 at the top, going clockwise. */
function seatStyle(index: number, count: number): CSSProperties {
  if (count <= 1) return { left: "50%", top: "8%" };
  const angle = -90 + (360 / count) * index;
  const rad = (angle * Math.PI) / 180;
  // Kept well inside 50% so a badge (capped at --badge-max-w wide, see
  // .table-board__player in Table.css) can never reach the surface edge.
  const rx = 32;
  const ry = 32;
  const left = 50 + rx * Math.cos(rad);
  const top = 50 + ry * Math.sin(rad);
  // More seats means less angular room between neighbors, so the safe
  // width for each badge shrinks accordingly — capped at 34cqw (the size
  // that's safe for as few as ~4 seats) and never narrower than 16cqw
  // (below which the truncated text stops being useful at all).
  const maxWidthCqw = Math.min(34, Math.max(16, 140 / count));
  return { left: `${left}%`, top: `${top}%`, ["--badge-max-w" as string]: `${maxWidthCqw}cqw` };
}

/**
 * Lightweight visual feedback for hand rotation/swap: there is no dedicated
 * animation/event stream (a much larger separate effort, see README), so
 * this simply pulses every player badge for a moment whenever the just-
 * played card was a ROTATE_HANDS or SWAP_HAND, detected from the public
 * discard pile alone — no secret data needed to show "something moved here".
 */
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

export function Table({ publicState, compact = false, ownPlayerId }: TableProps) {
  const currentPlayer = publicState.players.find((p) => p.playerId === publicState.currentPlayerId);
  const shufflePulse = useHandShufflePulse(publicState);
  // See CROWDED_PLAYER_THRESHOLD: past this many seats the ellipse can no
  // longer guarantee non-overlapping badges on a short viewport, so these
  // fall back to two wrapping rows instead (.table-board__surface--crowded).
  const crowded = publicState.players.length >= CROWDED_PLAYER_THRESHOLD;

  function renderPlayerBadge(p: PublicPlayerView, seatIndex: number | null) {
    const statusBits = [p.eliminated ? "ausgeschieden" : "", !p.connected && p.type === "HUMAN" ? "getrennt" : ""].filter(Boolean);
    // The visible name is CSS-truncated with an ellipsis when space is
    // tight (see .table-board__player-name in Table.css) — the underlying
    // text node is never shortened, so screen readers already get the full
    // name from it. `title` exists purely as a hover tooltip for sighted
    // pointer users on a truncated badge; it restates the same information
    // already in the visible/accessible text rather than adding anything a
    // screen reader would announce differently, so it doesn't introduce a
    // second, conflicting reading of the badge.
    const fullTitle = `${p.displayName}${statusBits.length ? ` (${statusBits.join(", ")})` : ""} – ${p.cardCount} Karten`;
    return (
      <div
        key={p.playerId}
        className={`table-board__player ${crowded ? "table-board__player--crowded" : ""} ${p.playerId === publicState.currentPlayerId ? "table-board__player--active" : ""} ${p.playerId === ownPlayerId ? "table-board__player--own" : ""} ${shufflePulse ? "table-board__player--pulse" : ""}`}
        style={seatIndex !== null ? seatStyle(seatIndex, publicState.players.length) : undefined}
        title={fullTitle}
      >
        <span className="table-board__player-name">
          {p.type === "BOT" ? "🤖 " : "👤 "}
          {p.displayName}
          {p.eliminated ? " ❌" : ""}
          {!p.connected && p.type === "HUMAN" ? " (getrennt)" : ""}
        </span>
        <span className="table-board__player-count">{p.cardCount} Karten</span>
        {publicState.pendingSkipTargets[p.playerId] > 0 && (
          <span className="table-board__skip-stamp" title="Nächster Zug wird ausgesetzt">
            AUSGESETZT
          </span>
        )}
      </div>
    );
  }

  const centerCluster = (
    <div className="table-board__center">
      <div className="table-board__pile">
        <span className="table-board__pile-label">Ziehstapel</span>
        <Card def={{ defId: "back", color: "WILD", type: "WILD" }} faceDown size={compact ? "small" : "normal"} />
        <span className="table-board__pile-count">{publicState.drawPileCount}</span>
      </div>

      <div className="table-board__pile">
        <span className="table-board__pile-label">Ablagestapel</span>
        {publicState.topDiscard ? (
          <Card def={publicState.topDiscard} size={compact ? "small" : "normal"} playable={false} />
        ) : (
          <div className={`uno-card uno-card--${compact ? "small" : "normal"}`} />
        )}
        {publicState.activeColor && <span className={`table-board__active-color table-board__active-color--${publicState.activeColor}`} />}
      </div>

      <div className="table-board__direction" aria-label="Spielrichtung">
        {publicState.direction === 1 ? "↻" : "↺"}
      </div>
    </div>
  );

  return (
    <div className={`table-board ${compact ? "table-board--compact" : ""}`}>
      <div className="table-board__arena">
        {/*
         * The arena is whatever size the surrounding flex layout gives it —
         * on a tall viewport with few competing elements that can be far
         * taller than a table actually needs, which used to stretch the
         * player ellipse into a tall, mostly-empty oval. `__surface` is
         * fitted to a fixed aspect ratio *within* that space (via container
         * query units, see Table.css) so the table itself stays reasonably
         * proportioned; any genuinely leftover space becomes calm, centered
         * margin instead of dead space inside the ellipse.
         */}
        {crowded ? (
          // Crowded mode drops the ellipse entirely: badges are laid out
          // in-flow (two wrapping rows) instead of position: absolute at a
          // computed angle, so they can never overlap regardless of how
          // many there are or how little room the surface has — flexbox
          // wrapping, not radius tuning, is what guarantees that here.
          <div className={`table-board__surface table-board__surface--crowded ${shufflePulse ? "table-board__surface--pulse" : ""}`}>
            <div className="table-board__row">
              {publicState.players.slice(0, Math.ceil(publicState.players.length / 2)).map((p) => renderPlayerBadge(p, null))}
            </div>
            {centerCluster}
            <div className="table-board__row">
              {publicState.players.slice(Math.ceil(publicState.players.length / 2)).map((p) => renderPlayerBadge(p, null))}
            </div>
          </div>
        ) : (
          <div className={`table-board__surface ${shufflePulse ? "table-board__surface--pulse" : ""}`}>
            {publicState.players.map((p, i) => renderPlayerBadge(p, i))}
            {centerCluster}
          </div>
        )}
      </div>

      {publicState.pendingEffect?.type === "DRAW_STACK" && (
        <div className="table-board__penalty">STRAFE: +{publicState.pendingEffect.amount}</div>
      )}

      {currentPlayer && publicState.phase !== "GAME_OVER" && (
        <div className="table-board__turn-banner">{currentPlayer.displayName.toUpperCase()} IST DRAN</div>
      )}

      {publicState.phase === "GAME_OVER" && (
        <div className="table-board__turn-banner table-board__turn-banner--win">
          {publicState.players.find((p) => p.playerId === publicState.winnerPlayerId)?.displayName ?? "?"} GEWINNT!
        </div>
      )}
    </div>
  );
}
