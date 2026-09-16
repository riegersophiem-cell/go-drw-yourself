import type { CardColor, CardDefinition, CardType } from "./types.ts";

const COLORS: Exclude<CardColor, "WILD">[] = ["RED", "BLUE", "GREEN", "YELLOW", "VIOLET"];

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
 * Deck size is derived entirely from the counts below — never hardcode a
 * total card count anywhere else. Verbindlich (see GAME_RULE_UPDATE_REPORT.md):
 *   - Basic (PASS/LINK/PULSE/ARC): 5 colors x 4 copies = 20 each, 80 total.
 *   - Core Action (SHOVE/TARGET/LOWEST/DITCH): 5 colors x 2 copies = 10 each, 40 total.
 * Chaos cards (SWAP/ROTATE/SKIP ALL/the WILD_* family) are colorless and
 * generated as flat totals below, not per-color. Quantities for the
 * remaining colored action cards and the rarer chaos cards are
 * TODO_VERIFY_OFFICIAL_RULE / TODO_DEFINE_COLORED_ACTION_COPY_COUNT where
 * noted and kept configurable via COUNTS below rather than hardcoded inline.
 */
const COUNTS = {
  basicPerColor: 4, // verbindlich: PASS/LINK/PULSE/ARC (TRIANGLE/SQUARE/CIRCLE/SEMICIRCLE)
  coreActionPerColor: 2, // verbindlich: SHOVE/TARGET/LOWEST/DITCH (DIAMOND/TARGET_SKIP/GIVE_TWO_TO_LOWEST/DISCARD_ONE_EXTRA)
  skipPerColor: 2,
  reversePerColor: 2,
  draw1PerColor: 2, // TODO_VERIFY_OFFICIAL_RULE: Draw 1 card count in No Mercy
  draw2PerColor: 2,
  draw4PerColor: 1, // TODO_DEFINE_COLORED_ACTION_COPY_COUNT: no official count confirmed for this colored Draw Four yet
  discardAllPerColor: 1, // TODO_VERIFY_OFFICIAL_RULE
  // Chaos family — colorless, flat totals (not multiplied by color count).
  // rotateHandsTotal/swapHandTotal preserve the previous overall quantities
  // from when these were per-color cards (1x5=5 and 2x5=10) now that they've
  // moved to the colorless Chaos family instead of inventing new numbers.
  rotateHandsTotal: 5,
  swapHandTotal: 10,
  wild: 4,
  wildDraw4: 4,
  wildDraw6: 2, // TODO_VERIFY_OFFICIAL_RULE
  wildDraw10: 1, // TODO_VERIFY_OFFICIAL_RULE
  skipEveryone: 2, // TODO_VERIFY_OFFICIAL_RULE
  wildReverseDraw4: 2, // TODO_VERIFY_OFFICIAL_RULE
  wildColorRoulette: 2, // TODO_VERIFY_OFFICIAL_RULE
};

const BASIC_TYPES: CardType[] = ["TRIANGLE", "SQUARE", "CIRCLE", "SEMICIRCLE"]; // PASS/LINK/PULSE/ARC
const CORE_ACTION_TYPES: CardType[] = ["DIAMOND", "TARGET_SKIP", "GIVE_TWO_TO_LOWEST", "DISCARD_ONE_EXTRA"]; // SHOVE/TARGET/LOWEST/DITCH

export function buildStandardDeck(): CardDefinition[] {
  const defs: CardDefinition[] = [];

  for (const color of COLORS) {
    for (const type of BASIC_TYPES) {
      for (let i = 0; i < COUNTS.basicPerColor; i++) defs.push(coloredDef(color, type));
    }
    for (const type of CORE_ACTION_TYPES) {
      for (let i = 0; i < COUNTS.coreActionPerColor; i++) defs.push(coloredDef(color, type));
    }
    for (let i = 0; i < COUNTS.skipPerColor; i++) defs.push(coloredDef(color, "SKIP"));
    for (let i = 0; i < COUNTS.reversePerColor; i++) defs.push(coloredDef(color, "REVERSE"));
    for (let i = 0; i < COUNTS.draw1PerColor; i++) defs.push(coloredDef(color, "DRAW_1"));
    for (let i = 0; i < COUNTS.draw2PerColor; i++) defs.push(coloredDef(color, "DRAW_2"));
    for (let i = 0; i < COUNTS.draw4PerColor; i++) defs.push(coloredDef(color, "DRAW_4"));
    for (let i = 0; i < COUNTS.discardAllPerColor; i++) defs.push(coloredDef(color, "DISCARD_ALL"));
  }

  // Chaos family: colorless (color "WILD"), so always playable and always
  // requiring a fresh regular-color choice on resolution (see
  // isWildDefinition() below and the WAITING_FOR_COLOR phase in
  // rulesEngine.ts). SWAP_HAND and ROTATE_HANDS moved here from the
  // per-color loop above — see GAME_RULE_UPDATE_REPORT.md.
  for (let i = 0; i < COUNTS.rotateHandsTotal; i++) defs.push(coloredDef("WILD", "ROTATE_HANDS"));
  for (let i = 0; i < COUNTS.swapHandTotal; i++) defs.push(coloredDef("WILD", "SWAP_HAND"));
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
    def.type === "DRAW_4" ||
    def.type === "WILD_DRAW_4" ||
    def.type === "WILD_DRAW_6" ||
    def.type === "WILD_DRAW_10" ||
    def.type === "WILD_REVERSE_DRAW_4"
  );
}

/**
 * The three Chaos "terminal" draw cards (ACTION_CHAOS_LIFECYCLE spec section
 * 16): they may top an existing normal draw stack same as any other draw
 * card, but once played the stack is locked — no further card, of any kind,
 * may top it afterward.
 */
export function isTerminalDrawCard(def: CardDefinition): boolean {
  return def.type === "WILD_REVERSE_DRAW_4" || def.type === "WILD_DRAW_6" || def.type === "WILD_DRAW_10";
}

export function drawAmountOf(def: CardDefinition): number {
  switch (def.type) {
    case "DRAW_1":
      return 1;
    case "DRAW_2":
      return 2;
    case "DRAW_4":
      return 4;
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
