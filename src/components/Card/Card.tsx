import { PLAIN_SYMBOL_TYPES, type CardColor, type CardDefinition } from "../../game/types";
import { CardIcon } from "./CardIcons";
import "./Card.css";

const COLOR_HEX: Record<CardColor, string> = {
  RED: "#e5484d",
  BLUE: "#3b82f6",
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  WILD: "#18181b",
};

// Accessible/plain-language names (section 27 of the UI/UX brief): symbols
// alone must never be the only way to understand a card's function.
const ACCESSIBLE_NAME_BY_TYPE: Record<CardDefinition["type"], string> = {
  TRIANGLE: "Dreieck",
  SQUARE: "Quadrat",
  CIRCLE: "Kreis",
  DIAMOND: "Raute",
  SEMICIRCLE: "Halbkreis",
  ROTATE_HANDS: "Alle Hände weitergeben",
  TARGET_SKIP: "Spieler für nächsten Zug aussetzen",
  GIVE_TWO_TO_LOWEST: "Zwei Karten an die kleinste Hand",
  DISCARD_ONE_EXTRA: "Eine zusätzliche Karte abwerfen",
  SWAP_HAND: "Hand mit Spieler tauschen",
  SKIP: "Nächsten Spieler aussetzen",
  REVERSE: "Spielrichtung umkehren",
  DRAW_1: "Eine Karte ziehen lassen",
  DRAW_2: "Zwei Karten ziehen lassen",
  WILD: "Farbe wählen",
  WILD_DRAW_4: "Vier Karten ziehen lassen und Farbe wählen",
  WILD_DRAW_6: "Sechs Karten ziehen lassen und Farbe wählen",
  WILD_DRAW_10: "Zehn Karten ziehen lassen und Farbe wählen",
  SKIP_EVERYONE: "Alle anderen aussetzen",
  DISCARD_ALL: "Alle Karten dieser Farbe abwerfen",
  WILD_REVERSE_DRAW_4: "Richtung umkehren, vier Karten ziehen lassen und Farbe wählen",
  WILD_COLOR_ROULETTE: "Zufällige Farbe",
};

/** Action cards (everything with a rule effect) get the holographic special-card look. */
function isActionCard(def: CardDefinition): boolean {
  return !PLAIN_SYMBOL_TYPES.includes(def.type);
}

export interface CardProps {
  def: CardDefinition;
  playable?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  size?: "small" | "normal";
  onClick?: () => void;
}

export function Card({ def, playable = true, selected = false, faceDown = false, size = "normal", onClick }: CardProps) {
  if (faceDown) {
    return <div className={`uno-card uno-card--back uno-card--${size}`} aria-label="verdeckte Karte" />;
  }

  const color = COLOR_HEX[def.color];
  const accessibleName = ACCESSIBLE_NAME_BY_TYPE[def.type] ?? def.type;
  const action = isActionCard(def);

  return (
    <button
      type="button"
      className={`uno-card uno-card--${size} ${playable ? "uno-card--playable" : "uno-card--disabled"} ${selected ? "uno-card--selected" : ""} ${action ? "uno-card--action" : ""}`}
      style={{ ["--card-color" as string]: color }}
      onClick={onClick}
      disabled={!playable}
      title={accessibleName}
      aria-label={`${def.color !== "WILD" ? def.color + " " : ""}${accessibleName}`}
    >
      <span className="uno-card__icon">
        <CardIcon type={def.type} />
      </span>
    </button>
  );
}
