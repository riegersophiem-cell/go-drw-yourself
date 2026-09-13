import type { CardColor, CardType } from "../../game/types";

/**
 * The v1 asset drop (see project docs) is the ONLY permitted source for how
 * a card looks — every colored/wild front and the card back are complete,
 * final designs. Geometry cards deliberately show symbols only; their
 * plain-language names remain here solely for accessible labels.
 */
export interface CardArtEntry {
  file: string;
  displayName: string;
  subtitle: string;
}

const PLAIN_ART: Record<CardType, { displayName: string; subtitle: string }> = {
  TRIANGLE: { displayName: "PASS", subtitle: "PLAY IT FORWARD" },
  SQUARE: { displayName: "LINK", subtitle: "HOLD THE LINE" },
  CIRCLE: { displayName: "PULSE", subtitle: "KEEP IT MOVING" },
  DIAMOND: { displayName: "SHOVE", subtitle: "PUSH THE TURN" },
  SEMICIRCLE: { displayName: "ARC", subtitle: "BEND THE FLOW" },
  ROTATE_HANDS: { displayName: "ROTATE", subtitle: "EVERY HAND MOVES" },
  TARGET_SKIP: { displayName: "TARGET", subtitle: "CHOOSE WHO SITS OUT" },
  GIVE_TWO_TO_LOWEST: { displayName: "LOWEST", subtitle: "SMALLEST HAND DRAWS 2" },
  DISCARD_ONE_EXTRA: { displayName: "DITCH", subtitle: "DROP ONE EXTRA" },
  SWAP_HAND: { displayName: "SWAP", subtitle: "TRADE COMPLETE HANDS" },
  SKIP: { displayName: "SKIP", subtitle: "NEXT PLAYER LOSES A TURN" },
  REVERSE: { displayName: "REVERSE", subtitle: "FLIP THE DIRECTION" },
  DRAW_1: { displayName: "DRAW 1", subtitle: "MAKE THEM TAKE ONE" },
  DRAW_2: { displayName: "DRAW 2", subtitle: "MAKE THEM TAKE TWO" },
  DISCARD_ALL: { displayName: "DROP ALL", subtitle: "DUMP ONE COLOR" },
  // Wild types below use their own WILD_ART entry instead of this table's
  // per-color file naming — listed here only so the Record<CardType, ...>
  // stays exhaustive for the colored branch's type-checking.
  WILD: { displayName: "WILD", subtitle: "CHOOSE THE COLOR" },
  WILD_DRAW_4: { displayName: "WILD DRAW 4", subtitle: "CHOOSE. THEY DRAW FOUR." },
  WILD_DRAW_6: { displayName: "WILD DRAW 6", subtitle: "CHOOSE. THEY DRAW SIX." },
  WILD_DRAW_10: { displayName: "WILD DRAW 10", subtitle: "CHOOSE. THEY DRAW TEN." },
  SKIP_EVERYONE: { displayName: "SKIP ALL", subtitle: "EVERYONE ELSE SITS OUT" },
  WILD_REVERSE_DRAW_4: { displayName: "REVERSE +4", subtitle: "FLIP IT. THEY DRAW FOUR." },
  WILD_COLOR_ROULETTE: { displayName: "COLOR ROULETTE", subtitle: "LET CHAOS CHOOSE" },
};

const COLOR_FILE_SLUG: Record<Exclude<CardColor, "WILD">, string> = {
  RED: "red",
  BLUE: "blue",
  GREEN: "green",
  YELLOW: "yellow",
};

const WILD_TYPE_FILE_SLUG: Partial<Record<CardType, string>> = {
  WILD: "wild",
  WILD_DRAW_4: "draw_4",
  WILD_DRAW_6: "draw_6",
  WILD_DRAW_10: "draw_10",
  SKIP_EVERYONE: "skip_everyone",
  WILD_REVERSE_DRAW_4: "reverse_draw_4",
  WILD_COLOR_ROULETTE: "color_roulette",
};

export const CARD_BACK_FILE = "gdy_card_back";

/** Resolves a card's artwork file (without extension) and its baked-in plain-language text. */
export function getCardArt(color: CardColor, type: CardType): CardArtEntry {
  const info = PLAIN_ART[type];
  if (color === "WILD") {
    const slug = WILD_TYPE_FILE_SLUG[type];
    if (!slug) throw new Error(`No wild artwork for card type ${type}`);
    return { file: `gdy_wild_${slug}`, ...info };
  }
  return { file: `gdy_${COLOR_FILE_SLUG[color]}_${type.toLowerCase()}`, ...info };
}

// Vite bundles every file this glob matches and gives back its final URL —
// the only way to reference all 68 assets without a hand-written import per file.
const CARD_SVG_URLS = import.meta.glob<string>("../../assets/cards/*.svg", { eager: true, query: "url", import: "default" });

function resolveUrl(file: string): string {
  const url = CARD_SVG_URLS[`../../assets/cards/${file}.svg`];
  if (!url) throw new Error(`Missing card artwork file: ${file}.svg`);
  return url;
}

export function cardArtUrl(color: CardColor, type: CardType): string {
  return resolveUrl(getCardArt(color, type).file);
}

export const cardBackUrl = resolveUrl(CARD_BACK_FILE);
