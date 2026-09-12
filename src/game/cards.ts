import type { CardColor, CardDefinition, CardType } from "./types.ts";

const COLORS: Exclude<CardColor, "WILD">[] = ["RED", "BLUE", "GREEN", "YELLOW"];

let idCounter = 0;
function defId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function coloredDef(color: CardColor, type: CardType): CardDefinition {
  return { defId: defId(`c_${color}_${type}`), color, type };
}

/**
 * Builds one physical UNO Show 'Em No Mercy deck as CardDefinitions.
 *
 * The former 0-9 number cards were replaced per the UI/UX brief with a
 * symbol/action system (see types.ts CardType doc comments) — quantities
 * mirror the original slot they replaced (ROTATE_HANDS/ex-0 once per color,
 * everything else ex-1..9 twice per color). Quantities for rarer action
 * cards are TODO_VERIFY_OFFICIAL_RULE and kept configurable via COUNTS below
 * rather than hardcoded inline.
 */
const COUNTS = {
  rotateHandsPerColor: 1, // ex "0"
  formerNumberPerColor: 2, // ex "1".."9" (triangle/square/circle/target_skip/give_two/discard_one/swap_hand/diamond/semicircle)
  skipPerColor: 2,
  reversePerColor: 2,
  draw1PerColor: 2, // TODO_VERIFY_OFFICIAL_RULE: Draw 1 card count in No Mercy
  draw2PerColor: 2,
  discardAllPerColor: 1, // TODO_VERIFY_OFFICIAL_RULE
  wild: 4,
  wildDraw4: 4,
  wildDraw6: 2, // TODO_VERIFY_OFFICIAL_RULE
  wildDraw10: 1, // TODO_VERIFY_OFFICIAL_RULE
  skipEveryone: 2, // TODO_VERIFY_OFFICIAL_RULE
  wildReverseDraw4: 2, // TODO_VERIFY_OFFICIAL_RULE
  wildColorRoulette: 2, // TODO_VERIFY_OFFICIAL_RULE
};

const FORMER_NUMBER_TYPES: CardType[] = [
  "TRIANGLE", // ex 1
  "SQUARE", // ex 2
  "CIRCLE", // ex 3
  "TARGET_SKIP", // ex 4
  "GIVE_TWO_TO_LOWEST", // ex 5
  "DISCARD_ONE_EXTRA", // ex 6
  "SWAP_HAND", // ex 7
  "DIAMOND", // ex 8
  "SEMICIRCLE", // ex 9
];

export function buildStandardDeck(): CardDefinition[] {
  const defs: CardDefinition[] = [];

  for (const color of COLORS) {
    for (let i = 0; i < COUNTS.rotateHandsPerColor; i++) defs.push(coloredDef(color, "ROTATE_HANDS"));
    for (const type of FORMER_NUMBER_TYPES) {
      for (let i = 0; i < COUNTS.formerNumberPerColor; i++) defs.push(coloredDef(color, type));
    }
    for (let i = 0; i < COUNTS.skipPerColor; i++) defs.push(coloredDef(color, "SKIP"));
    for (let i = 0; i < COUNTS.reversePerColor; i++) defs.push(coloredDef(color, "REVERSE"));
    for (let i = 0; i < COUNTS.draw1PerColor; i++) defs.push(coloredDef(color, "DRAW_1"));
    for (let i = 0; i < COUNTS.draw2PerColor; i++) defs.push(coloredDef(color, "DRAW_2"));
    for (let i = 0; i < COUNTS.discardAllPerColor; i++) defs.push(coloredDef(color, "DISCARD_ALL"));
  }

  for (let i = 0; i < COUNTS.wild; i++) defs.push(coloredDef("WILD", "WILD"));
  for (let i = 0; i < COUNTS.wildDraw4; i++) defs.push(coloredDef("WILD", "WILD_DRAW_4"));
  for (let i = 0; i < COUNTS.wildDraw6; i++) defs.push(coloredDef("WILD", "WILD_DRAW_6"));
  for (let i = 0; i < COUNTS.wildDraw10; i++) defs.push(coloredDef("WILD", "WILD_DRAW_10"));
  for (let i = 0; i < COUNTS.skipEveryone; i++) defs.push(coloredDef("WILD", "SKIP_EVERYONE"));
  for (let i = 0; i < COUNTS.wildReverseDraw4; i++) defs.push(coloredDef("WILD", "WILD_REVERSE_DRAW_4"));
  for (let i = 0; i < COUNTS.wildColorRoulette; i++) defs.push(coloredDef("WILD", "WILD_COLOR_ROULETTE"));

  return defs;
}

export function isWildDefinition(def: CardDefinition): boolean {
  return def.color === "WILD";
}

export function isDrawCard(def: CardDefinition): boolean {
  return (
    def.type === "DRAW_1" ||
    def.type === "DRAW_2" ||
    def.type === "WILD_DRAW_4" ||
    def.type === "WILD_DRAW_6" ||
    def.type === "WILD_DRAW_10" ||
    def.type === "WILD_REVERSE_DRAW_4"
  );
}

export function drawAmountOf(def: CardDefinition): number {
  switch (def.type) {
    case "DRAW_1":
      return 1;
    case "DRAW_2":
      return 2;
    case "WILD_DRAW_4":
    case "WILD_REVERSE_DRAW_4":
      return 4;
    case "WILD_DRAW_6":
      return 6;
    case "WILD_DRAW_10":
      return 10;
    default:
      return 0;
  }
}
