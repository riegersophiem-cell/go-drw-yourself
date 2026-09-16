import type { CardColor, CardDefinition, PendingEffect, TurnPhase } from "../../game/types";
import { CHAOS_TYPES } from "../../game/types";
import { Card } from "../Card/Card";
import { CenterHalo } from "./CenterHalo";
import "./DiscardStage.css";

export interface DiscardStageProps {
  topDiscard: CardDefinition | null;
  drawPileCount: number;
  pendingEffect: PendingEffect;
  /** GameState.activeColor — the authoritative "currently in play" color, distinct from a Chaos card's own printed color (see CenterHalo). */
  activeColor: CardColor | null;
  phase: TurnPhase;
  compact?: boolean;
}

/**
 * The Hero Center: discard pile (visual hero, ~100% reference size), draw
 * pile (~55% of that), and the Center Halo underneath. No permanent info
 * modules beyond the live draw-stack chip when one is active — see
 * TABLE_UI_IMPLEMENTATION_REPORT.md section 3.
 */
export function DiscardStage({ topDiscard, drawPileCount, pendingEffect, activeColor, phase, compact = false }: DiscardStageProps) {
  const isChaosTop = topDiscard ? CHAOS_TYPES.includes(topDiscard.type) : false;
  const isUnresolvedChaos = isChaosTop && phase === "WAITING_FOR_COLOR";
  const resolvedColor = isChaosTop ? activeColor : (topDiscard?.color ?? null);

  return (
    <div className={`discard-stage ${compact ? "discard-stage--compact" : ""}`}>
      {pendingEffect?.type === "DRAW_STACK" && (
        <div className="discard-stage__stack-chip">
          <span aria-hidden="true">▰</span>
          <strong>+{pendingEffect.amount}</strong>
        </div>
      )}
      <div className="discard-stage__grid">
        <div className="discard-stage__pile discard-stage__pile--draw" data-draw-pile="true">
          <div className="discard-stage__card-stack discard-stage__card-stack--draw">
            <Card def={{ defId: "back", color: "WILD", type: "WILD" }} faceDown size={compact ? "table" : "normal"} />
            {/* TABLE_DEVICE: the count reads as a small badge attached to the
                draw pile itself, not a loose line of text floating below it
                (see TABLE_DEVICE_POLISH_REPORT.md). Mobile keeps its
                original layout untouched, see the sibling span below. */}
            {!compact && <span className="discard-stage__count discard-stage__count--badge">{drawPileCount}</span>}
          </div>
          {compact && <span className="discard-stage__count">{drawPileCount}</span>}
        </div>
        <div className="discard-stage__pile discard-stage__pile--discard">
          <CenterHalo isUnresolvedChaos={isUnresolvedChaos} resolvedColor={resolvedColor} />
          <div className="discard-stage__card-stack discard-stage__card-stack--hero">
            {topDiscard ? <Card def={topDiscard} size="hero" display /> : <div className="uno-card uno-card--hero" />}
            {isChaosTop && !isUnresolvedChaos && resolvedColor && resolvedColor !== "WILD" && (
              <>
                {/* The card art itself has no colored Chaos variants (only
                    "black" assets exist, see CARD_ASSET_REPORT.md) — this
                    blend-mode tint makes the resolved card genuinely read as
                    that color instead of only a corner badge (brief section
                    13: "die Karte selbst muss den gewählten Farbstate
                    zeigen"), while keeping the artwork's linework visible. */}
                <span className={`discard-stage__resolved-tint discard-stage__resolved-tint--${resolvedColor}`} aria-hidden="true" />
                <span className={`discard-stage__resolved-color discard-stage__resolved-color--${resolvedColor}`} title={`Gewählte Farbe: ${resolvedColor}`} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
