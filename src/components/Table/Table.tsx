import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PublicGameState } from "../../game/types";
import { Card } from "../Card/Card";
import "./Table.css";

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
  const rx = 44;
  const ry = 40;
  const left = 50 + rx * Math.cos(rad);
  const top = 50 + ry * Math.sin(rad);
  return { left: `${left}%`, top: `${top}%` };
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

  return (
    <div className={`table-board ${compact ? "table-board--compact" : ""}`}>
      <div className={`table-board__arena ${shufflePulse ? "table-board__arena--pulse" : ""}`}>
        {publicState.players.map((p, i) => (
          <div
            key={p.playerId}
            className={`table-board__player ${p.playerId === publicState.currentPlayerId ? "table-board__player--active" : ""} ${p.playerId === ownPlayerId ? "table-board__player--own" : ""} ${shufflePulse ? "table-board__player--pulse" : ""}`}
            style={seatStyle(i, publicState.players.length)}
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
        ))}

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
