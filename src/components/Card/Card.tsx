import type { CardDefinition } from "../../game/types";
import { cardArtPngUrl, cardBackPngUrl, getCardArt } from "./cardArt";
import "./Card.css";

const GEOMETRY_TYPES = new Set(["TRIANGLE", "SQUARE", "CIRCLE", "DIAMOND", "SEMICIRCLE"]);

export interface CardProps {
  def: CardDefinition;
  playable?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  /**
   * A pure display card (the discard pile's top card) — never dimmed and
   * never interactive, unlike an unplayable hand card which is deliberately
   * dimmed to distinguish it from one the player can act on.
   */
  display?: boolean;
  size?: "small" | "normal" | "table" | "hero";
  onClick?: () => void;
}

// The final PNG art (see cardArt.ts / CARD_ASSET_UPDATE_REPORT.md) is the
// only card art source now — no SVG counterpart exists for it, so this
// component renders a plain <img>, not the old <picture>/<source> pair that
// used to prefer an SVG and fall back to PNG.
export function Card({ def, playable = true, selected = false, faceDown = false, display = false, size = "normal", onClick }: CardProps) {
  if (faceDown) {
    return (
      <span className={`uno-card uno-card--back uno-card--${size}`}>
        <img className="uno-card__art" src={cardBackPngUrl} alt="" aria-label="verdeckte Karte" />
      </span>
    );
  }

  const art = getCardArt(def.color, def.type);
  const accessibleName = `${def.color !== "WILD" ? def.color + " " : ""}${art.displayName} – ${art.subtitle}`;
  const artUrl = cardArtPngUrl(def.color, def.type);

  if (display) {
    return (
      <span className={`uno-card uno-card--${size}`}>
        <img className="uno-card__art" src={artUrl} alt="" aria-label={accessibleName} />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`uno-card uno-card--${size} ${playable ? "uno-card--playable" : "uno-card--disabled"} ${selected ? "uno-card--selected" : ""}`}
      onClick={onClick}
      disabled={!playable}
      title={accessibleName}
      aria-label={accessibleName}
    >
      <img className="uno-card__art" src={artUrl} alt="" />
      {selected && !GEOMETRY_TYPES.has(def.type) && (
        <span className="uno-card__caption" aria-hidden="true">
          <strong>{def.color !== "WILD" ? def.color + " · " : ""}{art.displayName}</strong>
          <small>{art.subtitle}</small>
        </span>
      )}
    </button>
  );
}
