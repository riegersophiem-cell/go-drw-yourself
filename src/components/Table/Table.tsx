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

export function Table({ publicState, compact = false, ownPlayerId }: TableProps) {
  const currentPlayer = publicState.players.find((p) => p.playerId === publicState.currentPlayerId);

  return (
    <div className={`table-board ${compact ? "table-board--compact" : ""}`}>
      <div className="table-board__players">
        {publicState.players.map((p) => (
          <div
            key={p.playerId}
            className={`table-board__player ${p.playerId === publicState.currentPlayerId ? "table-board__player--active" : ""} ${p.playerId === ownPlayerId ? "table-board__player--own" : ""}`}
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
      </div>

      <div className="table-board__center">
        <div className="table-board__pile">
          <span className="table-board__pile-label">Ziehstapel</span>
          <Card def={{ defId: "back", color: "WILD", type: "WILD" }} faceDown size="normal" />
          <span className="table-board__pile-count">{publicState.drawPileCount}</span>
        </div>

        <div className="table-board__pile">
          <span className="table-board__pile-label">Ablagestapel</span>
          {publicState.topDiscard ? <Card def={publicState.topDiscard} size="normal" playable={false} /> : <div className="uno-card uno-card--normal" />}
          {publicState.activeColor && <span className={`table-board__active-color table-board__active-color--${publicState.activeColor}`} />}
        </div>

        <div className="table-board__direction" aria-label="Spielrichtung">
          {publicState.direction === 1 ? "↻ im Uhrzeigersinn" : "↺ gegen den Uhrzeigersinn"}
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
