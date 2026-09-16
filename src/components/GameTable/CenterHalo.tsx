import type { CSSProperties } from "react";
import type { CardColor } from "../../game/types";
import "./CenterHalo.css";

export interface CenterHaloProps {
  /** True while the top-of-pile card is a Chaos card still awaiting its color choice. */
  isUnresolvedChaos: boolean;
  /**
   * The color to tint the halo with once resolved — for a Chaos card this is
   * GameState.activeColor (the chosen color), NEVER the card's own printed
   * color, which a Chaos card's definition keeps as "WILD" even after
   * resolution (see the topCard/activeColor separation prepared in the game
   * rule update). For a normal colored card this is just its own color.
   */
  resolvedColor: CardColor | null;
}

const COLOR_HEX: Record<Exclude<CardColor, "WILD">, string> = {
  RED: "#e5484d",
  BLUE: "#3b82f6",
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  VIOLET: "#7047eb",
};

/**
 * The soft glow under the discard pile — calm blue/white at rest, briefly
 * takes on the just-played/resolved color, and goes holographic-graphite
 * while a Chaos card's color choice is still pending (brief section 14/36).
 */
export function CenterHalo({ isUnresolvedChaos, resolvedColor }: CenterHaloProps) {
  const hex = resolvedColor && resolvedColor !== "WILD" ? COLOR_HEX[resolvedColor] : null;

  return (
    <div
      className={`center-halo ${isUnresolvedChaos ? "center-halo--chaos" : ""} ${!isUnresolvedChaos && hex ? "center-halo--colored" : ""}`}
      style={!isUnresolvedChaos && hex ? ({ ["--halo-color" as string]: hex } as CSSProperties) : undefined}
      aria-hidden="true"
    />
  );
}
