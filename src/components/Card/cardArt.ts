import type { CardColor, CardType } from "../../game/types";

// The final PNG art in /public/assets/cards/final/png/ is the binding
// visual source of truth (see CARD_ASSET_UPDATE_REPORT.md and
// docs/cards/CARD_ASSET_MAPPING.md) — no CSS-rebuilt cards, no old SVG/PNG
// pair (moved to /public/assets/cards/deprecated/). Every CardType now has a
// real final asset — the DRAW_1/WILD_DRAW_4 gap from the initial batch was
// closed by a follow-up delivery (DRAW_1: full 5-color pixel-matched set;
// WILD_DRAW_4: colorless chaos card) plus a redesigned DRAW_2/DRAW_4 (only
// delivered in one color each — gold/violet — the other 4 colors were
// generated locally via an HSV hue-shift from that master, canonicalized
// against the exact hue already used elsewhere in the deck; see
// CARD_ASSET_UPDATE_REPORT.md for the generation method).
export interface CardArtEntry {
  url: string;
  displayName: string;
  subtitle: string;
}

const FINAL_PNG_DIR = "/assets/cards/final/png";

// The final art's own filenames spell yellow as "gold" — an asset-naming
// choice only, CardColor itself is untouched (still "YELLOW").
const FINAL_COLOR_SLUG: Record<Exclude<CardColor, "WILD">, string> = {
  RED: "red", BLUE: "blue", GREEN: "green", YELLOW: "gold", VIOLET: "violet",
};

interface ArtInfo {
  displayName: string;
  subtitle: string;
  urlFor: (color: CardColor) => string;
}

/** CORE family: core_{color}_{shape}.png — colored, one shape per type. */
function core(shape: "triangle" | "square" | "circle" | "half_circle" | "diamond", displayName: string, subtitle: string): ArtInfo {
  return {
    displayName,
    subtitle,
    urlFor: (color) => `${FINAL_PNG_DIR}/core_${FINAL_COLOR_SLUG[color as Exclude<CardColor, "WILD">]}_${shape}.png`,
  };
}

/** ACTION family: action_{color}_{slug}.png — colored, one slug per type. */
function action(
  slug: "timeout" | "lowest" | "one_more" | "draw_1" | "draw_2" | "draw_4" | "skip" | "reverse" | "drop_all",
  displayName: string,
  subtitle: string,
): ArtInfo {
  return {
    displayName,
    subtitle,
    urlFor: (color) => `${FINAL_PNG_DIR}/action_${FINAL_COLOR_SLUG[color as Exclude<CardColor, "WILD">]}_${slug}.png`,
  };
}

/** CHAOS family: chaos_{slug}.png — colorless, no color segment in the filename. */
function chaos(
  slug: "swap" | "rotate" | "skip_all" | "reverse_plus_4" | "wild_draw_4" | "wild_draw_6" | "wild_draw_10" | "color_roulette" | "wild_wish",
  displayName: string,
  subtitle: string,
): ArtInfo {
  return { displayName, subtitle, urlFor: () => `${FINAL_PNG_DIR}/chaos_${slug}.png` };
}

const ART: Record<CardType, ArtInfo> = {
  // CORE (Basic PASS/LINK/PULSE/ARC + Core Action SHOVE) — see docs/cards/CARD_LOGIC.md.
  TRIANGLE: core("triangle", "PASS", "PLAY IT FORWARD"),
  SQUARE: core("square", "LINK", "HOLD THE LINE"),
  CIRCLE: core("circle", "PULSE", "KEEP IT MOVING"),
  SEMICIRCLE: core("half_circle", "ARC", "BEND THE FLOW"),
  DIAMOND: core("diamond", "SHOVE", "PUSH THE TURN"),

  // ACTION (colored)
  TARGET_SKIP: action("timeout", "TARGET", "CHOOSE WHO SITS OUT"),
  GIVE_TWO_TO_LOWEST: action("lowest", "LOWEST", "SMALLEST HAND DRAWS 2"),
  DISCARD_ONE_EXTRA: action("one_more", "DITCH", "DROP ONE EXTRA"),
  DRAW_1: action("draw_1", "DRAW 1", "MAKE THEM TAKE ONE"),
  DRAW_2: action("draw_2", "DRAW 2", "MAKE THEM TAKE TWO"),
  DRAW_4: action("draw_4", "DRAW 4", "MAKE THEM TAKE FOUR"),
  SKIP: action("skip", "SKIP", "NEXT PLAYER SITS OUT"),
  REVERSE: action("reverse", "REVERSE", "FLIP THE DIRECTION"),
  DISCARD_ALL: action("drop_all", "DROP ALL", "DUMP ONE COLOR"),

  // CHAOS (colorless)
  SWAP_HAND: chaos("swap", "SWAP", "TRADE COMPLETE HANDS"),
  ROTATE_HANDS: chaos("rotate", "ROTATE", "EVERY HAND MOVES"),
  SKIP_EVERYONE: chaos("skip_all", "SKIP ALL", "EVERYONE ELSE SITS OUT"),
  WILD_REVERSE_DRAW_4: chaos("reverse_plus_4", "REVERSE +4", "FLIP IT. THEY DRAW FOUR."),
  WILD_DRAW_4: chaos("wild_draw_4", "WILD DRAW 4", "CHOOSE. THEY DRAW FOUR."),
  WILD_DRAW_6: chaos("wild_draw_6", "WILD DRAW 6", "CHOOSE. THEY DRAW SIX."),
  WILD_DRAW_10: chaos("wild_draw_10", "WILD DRAW 10", "CHOOSE. THEY DRAW TEN."),
  WILD_COLOR_ROULETTE: chaos("color_roulette", "COLOR ROULETTE", "LET CHAOS CHOOSE"),
  WILD: chaos("wild_wish", "WILD", "CHOOSE THE COLOR"),
};

export function getCardArt(color: CardColor, type: CardType): CardArtEntry {
  const info = ART[type];
  return { url: info.urlFor(color), displayName: info.displayName, subtitle: info.subtitle };
}

export function cardArtPngUrl(color: CardColor, type: CardType): string {
  return getCardArt(color, type).url;
}

export const cardBackPngUrl = `${FINAL_PNG_DIR}/backcover.png`;
