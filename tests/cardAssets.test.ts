import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildStandardDeck } from "../src/game/cards";
import { getCardArt, cardBackPngUrl } from "../src/components/Card/cardArt";
import type { CardColor, CardType } from "../src/game/types";

const colors: Exclude<CardColor, "WILD">[] = ["RED", "BLUE", "GREEN", "YELLOW", "VIOLET"];

// Every colored (CORE/ACTION) type — see docs/cards/CARD_LOGIC.md.
const coloredTypes: CardType[] = [
  "TRIANGLE", "SQUARE", "CIRCLE", "SEMICIRCLE", "DIAMOND",
  "TARGET_SKIP", "GIVE_TWO_TO_LOWEST", "DISCARD_ONE_EXTRA",
  "DRAW_1", "DRAW_2", "DRAW_4", "SKIP", "REVERSE", "DISCARD_ALL",
];

// Every colorless CHAOS type.
const chaosTypes: CardType[] = [
  "SWAP_HAND", "ROTATE_HANDS", "SKIP_EVERYONE", "WILD_REVERSE_DRAW_4",
  "WILD_DRAW_4", "WILD_DRAW_6", "WILD_DRAW_10", "WILD_COLOR_ROULETTE", "WILD",
];

function assetFsPath(url: string): string {
  // url is a web-root-relative path like "/assets/cards/final/png/x.png" —
  // the actual file on disk lives under /public.
  return resolve(`public${url}`);
}

describe("card asset system", () => {
  it("has an existing PNG for every colored (CORE/ACTION) type in every regular color", () => {
    for (const color of colors) {
      for (const type of coloredTypes) {
        const { url } = getCardArt(color, type);
        expect(existsSync(assetFsPath(url)), url).toBe(true);
      }
    }
  });

  it("has an existing PNG for every colorless CHAOS type", () => {
    for (const type of chaosTypes) {
      const { url } = getCardArt("WILD", type);
      expect(existsSync(assetFsPath(url)), url).toBe(true);
    }
  });

  it("has an existing card-back PNG", () => {
    expect(existsSync(assetFsPath(cardBackPngUrl)), cardBackPngUrl).toBe(true);
  });

  it("uses the same colorless chaos artwork regardless of persisted source color", () => {
    expect(getCardArt("RED", "SWAP_HAND").url).toBe(getCardArt("VIOLET", "SWAP_HAND").url);
    expect(getCardArt("RED", "ROTATE_HANDS").url).toBe(getCardArt("BLUE", "ROTATE_HANDS").url);
    expect(getCardArt("RED", "WILD_COLOR_ROULETTE").url).toBe(getCardArt("GREEN", "WILD_COLOR_ROULETTE").url);
  });

  it("uses a distinct final-art PNG per color for a colored type", () => {
    const urls = new Set(colors.map((color) => getCardArt(color, "TRIANGLE").url));
    expect(urls.size).toBe(colors.length);
  });

  it("deals violet cards and the new regular DRAW 4 in fresh decks", () => {
    const deck = buildStandardDeck();
    expect(deck.some((card) => card.color === "VIOLET")).toBe(true);
    expect(deck.some((card) => card.color === "VIOLET" && card.type === "DRAW_4")).toBe(true);
    expect(deck.some((card) => card.type === "DRAW_4" && card.color !== "WILD")).toBe(true);
  });
});
