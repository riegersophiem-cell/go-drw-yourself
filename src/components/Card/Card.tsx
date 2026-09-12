import { PLAIN_SYMBOL_TYPES, type CardColor, type CardDefinition, type CardType } from "../../game/types";
import "./Card.css";

const COLOR_HEX: Record<CardColor, string> = {
  RED: "#e5484d",
  BLUE: "#3b82f6",
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  WILD: "#18181b",
};

// Former 0-9 number cards carry no visible digits any more — each ex-slot
// gets a distinct symbol/action glyph instead (see game/types.ts CardType).
const SYMBOL_BY_TYPE: Record<CardType, string> = {
  TRIANGLE: "▲",
  SQUARE: "■",
  CIRCLE: "●",
  DIAMOND: "◆",
  SEMICIRCLE: "◖",
  ROTATE_HANDS: "🔁",
  TARGET_SKIP: "🎯",
  GIVE_TWO_TO_LOWEST: "🔻+2",
  DISCARD_ONE_EXTRA: "-1",
  SWAP_HAND: "⇄",
  SKIP: "⦸",
  REVERSE: "↺",
  DRAW_1: "+1",
  DRAW_2: "+2",
  WILD: "★",
  WILD_DRAW_4: "+4",
  WILD_DRAW_6: "+6",
  WILD_DRAW_10: "+10",
  SKIP_EVERYONE: "⦸⦸",
  DISCARD_ALL: "ALL",
  WILD_REVERSE_DRAW_4: "↺+4",
  WILD_COLOR_ROULETTE: "🎡",
};

// Accessible/plain-language names (section 27 of the UI/UX brief): symbols
// alone must never be the only way to understand a card's function.
const ACCESSIBLE_NAME_BY_TYPE: Record<CardType, string> = {
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
  const symbol = SYMBOL_BY_TYPE[def.type] ?? "?";
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
      <span className="uno-card__corner uno-card__corner--top">{symbol}</span>
      <span className="uno-card__symbol">{symbol}</span>
      <span className="uno-card__corner uno-card__corner--bottom">{symbol}</span>
    </button>
  );
}
