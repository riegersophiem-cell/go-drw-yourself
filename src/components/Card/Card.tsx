import type { CardDefinition } from "../../game/types";
import { cardArtUrl, cardBackUrl, getCardArt } from "./cardArt";
import "./Card.css";

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

export function Card({ def, playable = true, selected = false, faceDown = false, display = false, size = "normal", onClick }: CardProps) {
  if (faceDown) {
    return <img className={`uno-card uno-card--back uno-card--${size}`} src={cardBackUrl} alt="" aria-label="verdeckte Karte" />;
  }

  const art = getCardArt(def.color, def.type);
  // The artwork itself already spells out color, name, and subtitle in
  // plain language — see cardArt.ts — so the accessible name just restates
  // exactly that text rather than inventing a separate description.
  const accessibleName = `${def.color !== "WILD" ? def.color + " " : ""}${art.displayName} – ${art.subtitle}`;

  if (display) {
    return <img className={`uno-card uno-card--${size}`} src={cardArtUrl(def.color, def.type)} alt="" aria-label={accessibleName} />;
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
      <img className="uno-card__art" src={cardArtUrl(def.color, def.type)} alt="" />
      {selected && (
        <span className="uno-card__caption" aria-hidden="true">
          <strong>{def.color !== "WILD" ? def.color + " · " : ""}{art.displayName}</strong>
          <small>{art.subtitle}</small>
        </span>
      )}
    </button>
  );
}
