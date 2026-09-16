import { describe, expect, it } from "vitest";
import { buildStandardDeck, isWildDefinition } from "../src/game/cards";
import { createNewGame, toPublicGameState } from "../src/game/gameState";
import { chooseColor, isPlayable, playCard } from "../src/game/rulesEngine";
import { chooseBotAction } from "../src/game/botStrategy";
import { CHAOS_TYPES, CORE_ACTION_TYPES, PLAIN_SYMBOL_TYPES, type CardColor, type CardDefinition } from "../src/game/types";

const REGULAR_COLORS: Exclude<CardColor, "WILD">[] = ["RED", "BLUE", "GREEN", "YELLOW", "VIOLET"];

function countByType(deck: CardDefinition[], type: string): number {
  return deck.filter((d) => d.type === type).length;
}

describe("VIOLET is a full regular color", () => {
  it("is dealt in every fresh deck", () => {
    const deck = buildStandardDeck();
    expect(deck.some((d) => d.color === "VIOLET")).toBe(true);
  });

  it("matches the active color exactly like any other regular color", () => {
    const violetCard: CardDefinition = { defId: "t", color: "VIOLET", type: "SQUARE" };
    const state = { ...createNewGame("room", [{ playerId: "a", displayName: "A", type: "HUMAN" as const }, { playerId: "b", displayName: "B", type: "HUMAN" as const }]), activeColor: "VIOLET" as const };
    expect(isPlayable(violetCard, state)).toBe(true);
  });

  it("is not, itself, a wild/chaos color", () => {
    expect(isWildDefinition({ defId: "t", color: "VIOLET", type: "SQUARE" })).toBe(false);
  });
});

describe("deck composition — Basic family (PASS/LINK/PULSE/ARC)", () => {
  const deck = buildStandardDeck();

  it("has exactly 4 Basic types, matching PLAIN_SYMBOL_TYPES", () => {
    expect(PLAIN_SYMBOL_TYPES).toHaveLength(4);
    expect(new Set(PLAIN_SYMBOL_TYPES)).toEqual(new Set(["TRIANGLE", "SQUARE", "CIRCLE", "SEMICIRCLE"]));
  });

  it("deals exactly 20 of each Basic type (5 colors x 4 copies)", () => {
    for (const type of PLAIN_SYMBOL_TYPES) expect(countByType(deck, type)).toBe(20);
  });

  it("totals exactly 80 Basic cards", () => {
    const total = PLAIN_SYMBOL_TYPES.reduce((sum, type) => sum + countByType(deck, type), 0);
    expect(total).toBe(80);
  });

  it("every Basic card carries a real regular color, never WILD", () => {
    for (const card of deck) {
      if (PLAIN_SYMBOL_TYPES.includes(card.type)) expect(REGULAR_COLORS).toContain(card.color);
    }
  });
});

describe("deck composition — Core Action family (SHOVE/TARGET/LOWEST/DITCH)", () => {
  const deck = buildStandardDeck();

  it("has exactly 4 Core Action types, matching CORE_ACTION_TYPES", () => {
    expect(CORE_ACTION_TYPES).toHaveLength(4);
    expect(new Set(CORE_ACTION_TYPES)).toEqual(new Set(["DIAMOND", "TARGET_SKIP", "GIVE_TWO_TO_LOWEST", "DISCARD_ONE_EXTRA"]));
  });

  it("deals exactly 10 of each Core Action type (5 colors x 2 copies)", () => {
    for (const type of CORE_ACTION_TYPES) expect(countByType(deck, type)).toBe(10);
  });

  it("totals exactly 40 Core Action cards", () => {
    const total = CORE_ACTION_TYPES.reduce((sum, type) => sum + countByType(deck, type), 0);
    expect(total).toBe(40);
  });

  it("SHOVE (DIAMOND) is a regular-colored Action card, not Basic and not Chaos", () => {
    expect(PLAIN_SYMBOL_TYPES).not.toContain("DIAMOND");
    expect(CHAOS_TYPES).not.toContain("DIAMOND");
    expect(CORE_ACTION_TYPES).toContain("DIAMOND");
    const shove = deck.find((d) => d.type === "DIAMOND")!;
    expect(REGULAR_COLORS).toContain(shove.color);
  });
});

describe("Chaos family reclassification", () => {
  const deck = buildStandardDeck();

  it("SWAP (SWAP_HAND) is Chaos: colorless in every dealt copy", () => {
    expect(CHAOS_TYPES).toContain("SWAP_HAND");
    const swaps = deck.filter((d) => d.type === "SWAP_HAND");
    expect(swaps.length).toBeGreaterThan(0);
    for (const card of swaps) expect(card.color).toBe("WILD");
  });

  it("ROTATE (ROTATE_HANDS) is Chaos: colorless in every dealt copy", () => {
    expect(CHAOS_TYPES).toContain("ROTATE_HANDS");
    const rotates = deck.filter((d) => d.type === "ROTATE_HANDS");
    expect(rotates.length).toBeGreaterThan(0);
    for (const card of rotates) expect(card.color).toBe("WILD");
  });

  it("SKIP ALL (SKIP_EVERYONE) is Chaos: colorless in every dealt copy", () => {
    expect(CHAOS_TYPES).toContain("SKIP_EVERYONE");
    const skipAlls = deck.filter((d) => d.type === "SKIP_EVERYONE");
    expect(skipAlls.length).toBeGreaterThan(0);
    for (const card of skipAlls) expect(card.color).toBe("WILD");
  });

  it("every Chaos-typed card in the deck is colorless, with no exceptions", () => {
    for (const card of deck) {
      if (CHAOS_TYPES.includes(card.type)) expect(card.color).toBe("WILD");
    }
  });
});

describe("bots and VIOLET", () => {
  it("a bot can choose VIOLET as a wild color when it holds the most violet cards", () => {
    const violetHeavyHand = [
      { instanceId: "i1", def: { defId: "d1", color: "VIOLET", type: "SQUARE" } as CardDefinition },
      { instanceId: "i2", def: { defId: "d2", color: "VIOLET", type: "TRIANGLE" } as CardDefinition },
      { instanceId: "i3", def: { defId: "d3", color: "WILD", type: "WILD" } as CardDefinition },
    ];
    const state = createNewGame("room", [{ playerId: "a", displayName: "A", type: "HUMAN" as const }, { playerId: "b", displayName: "B", type: "HUMAN" as const }]);
    const action = chooseBotAction(
      { ownHand: violetHeavyHand, legalInstanceIds: ["i3"], publicState: toPublicGameState(state) },
      "NORMAL",
    );
    expect(action).toEqual(expect.objectContaining({ type: "PLAY_CARD", instanceId: "i3", chosenColor: "VIOLET" }));
  });

  it("a bot can legally play a VIOLET card and have it accepted by the rule engine", () => {
    let state = createNewGame("room", [{ playerId: "a", displayName: "A", type: "BOT" as const }, { playerId: "b", displayName: "B", type: "HUMAN" as const }]);
    const violetDefId = Object.entries(state.cardDefinitions).find(([, d]) => d.color === "VIOLET" && d.type === "SQUARE")?.[0];
    expect(violetDefId).toBeDefined();
    // Force VIOLET to be the active color and give the bot a matching card, mirroring how other rule tests set up scenarios.
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === violetDefId)!;
    const aHandId = state.players[0].currentHandId;
    state = { ...state, activeColor: "VIOLET", drawPile: state.drawPile.filter((id) => id !== instanceId), hands: { ...state.hands, [aHandId]: { ...state.hands[aHandId], cardInstanceIds: [instanceId, ...state.hands[aHandId].cardInstanceIds] } } };
    const result = playCard(state, "a", instanceId);
    expect(result.state.activeColor).toBe("VIOLET");
  });
});

describe("reconnect-safety: active color and chosen-color state persist on GameState", () => {
  it("a chosen VIOLET color survives a public/private projection roundtrip (simulating reconnect)", () => {
    let state = createNewGame("room", [{ playerId: "a", displayName: "A", type: "HUMAN" as const }, { playerId: "b", displayName: "B", type: "HUMAN" as const }]);
    const wildDefId = Object.entries(state.cardDefinitions).find(([, d]) => d.type === "WILD")![0];
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === wildDefId)!;
    const aHandId = state.players[0].currentHandId;
    state = { ...state, drawPile: state.drawPile.filter((id) => id !== instanceId), hands: { ...state.hands, [aHandId]: { ...state.hands[aHandId], cardInstanceIds: [instanceId, ...state.hands[aHandId].cardInstanceIds] } } };

    const played = playCard(state, "a", instanceId);
    expect(played.requiresColorChoice).toBe(true);
    const chosen = chooseColor(played.state, "a", "VIOLET");
    expect(chosen.activeColor).toBe("VIOLET");

    // Reconnect rebuilds public/private views purely from the persisted
    // GameState (see gameState.ts) - there is no separate cache to go stale.
    const publicView = toPublicGameState(chosen);
    expect(publicView.activeColor).toBe("VIOLET");
    // A brand-new projection built from the same state again is identical -
    // recomputing after "reconnecting" is idempotent, exactly like the
    // existing getLegalMoves reconnect test in rulesEngine.test.ts.
    expect(toPublicGameState(chosen)).toEqual(publicView);
  });
});

describe("mandatory Chaos color choice covers all three newly-reclassified cards", () => {
  it.each(["SWAP_HAND", "ROTATE_HANDS", "SKIP_EVERYONE"] as const)("%s always defers to WAITING_FOR_COLOR when played without a color", (type) => {
    let state = createNewGame("room", [{ playerId: "a", displayName: "A", type: "HUMAN" as const }, { playerId: "b", displayName: "B", type: "HUMAN" as const }, { playerId: "c", displayName: "C", type: "HUMAN" as const }]);
    const defId = Object.entries(state.cardDefinitions).find(([, d]) => d.type === type)![0];
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, id]) => id === defId)!;
    const aHandId = state.players[0].currentHandId;
    state = { ...state, drawPile: state.drawPile.filter((id) => id !== instanceId), hands: { ...state.hands, [aHandId]: { ...state.hands[aHandId], cardInstanceIds: [instanceId, ...state.hands[aHandId].cardInstanceIds] } } };

    const played = playCard(state, "a", instanceId);
    expect(played.requiresColorChoice).toBe(true);
    expect(played.state.phase).toBe("WAITING_FOR_COLOR");

    // Every one of the 5 regular colors, including VIOLET, must be an
    // acceptable resolution for the deferred choice.
    for (const color of REGULAR_COLORS) {
      const resolved = chooseColor(played.state, "a", color);
      expect(resolved.activeColor).toBe(color);
    }
  });
});
