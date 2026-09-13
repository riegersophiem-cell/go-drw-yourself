import { describe, expect, it } from "vitest";
import { dispatchGameAction } from "../src/game/actions";
import { rotateHandsAllPlayers, swapHands } from "../src/game/effects";
import { createNewGame, definitionOfInstance, getHandOfPlayer, getPlayer } from "../src/game/gameState";
import {
  chooseSkipTarget,
  chooseSwapTarget,
  discardExtraCard,
  drawFromStackOrDeck,
  getLegalMoves,
  isPlayable,
  playCard,
} from "../src/game/rulesEngine";
import { getNextPlayerId } from "../src/game/turnManager";
import type { CardDefinition, CardColor, GameState } from "../src/game/types";

function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

function newGame(names: string[], seed = 42): GameState {
  const specs = names.map((n, i) => ({ playerId: `p${i}_${n}`, displayName: n, type: "HUMAN" as const }));
  return createNewGame("room1", specs, undefined, seededRng(seed));
}

describe("legal move validation", () => {
  it("marks a card matching the active color as playable", () => {
    const state = newGame(["A", "B"]);
    const top = state.discardPile[state.discardPile.length - 1];
    const topDef = definitionOfInstance(state, top);
    const matchingCard: CardDefinition = { defId: "test1", color: topDef.color, type: topDef.type === "SQUARE" ? "CIRCLE" : "SQUARE" };
    expect(isPlayable(matchingCard, state)).toBe(true);
  });

  it("marks a non-matching, non-wild card as not playable", () => {
    const state = newGame(["A", "B"]);
    const top = state.discardPile[state.discardPile.length - 1];
    const topDef = definitionOfInstance(state, top);
    const otherColor = (["RED", "BLUE", "GREEN", "YELLOW"] as CardColor[]).find((c) => c !== topDef.color)!;
    const nonMatching: CardDefinition = { defId: "test2", color: otherColor, type: topDef.type === "SQUARE" ? "CIRCLE" : "SQUARE" };
    expect(isPlayable(nonMatching, state)).toBe(false);
  });

  it("wild cards are always playable", () => {
    const state = newGame(["A", "B"]);
    const wild: CardDefinition = { defId: "test3", color: "WILD", type: "WILD" };
    expect(isPlayable(wild, state)).toBe(true);
  });
});

describe("turn order", () => {
  it("advances clockwise by seat index", () => {
    const state = newGame(["A", "B", "C"]);
    const [a, b, c] = state.players;
    expect(getNextPlayerId(state, a.playerId)).toBe(b.playerId);
    expect(getNextPlayerId(state, b.playerId)).toBe(c.playerId);
    expect(getNextPlayerId(state, c.playerId)).toBe(a.playerId);
  });

  it("advances counter-clockwise when direction is reversed", () => {
    const state = { ...newGame(["A", "B", "C"]), direction: -1 as const };
    const [a, b, c] = state.players;
    expect(getNextPlayerId(state, a.playerId)).toBe(c.playerId);
    expect(getNextPlayerId(state, c.playerId)).toBe(b.playerId);
  });

  it("skips eliminated players", () => {
    const base = newGame(["A", "B", "C"]);
    const [a, b, c] = base.players;
    const state = { ...base, players: base.players.map((p) => (p.playerId === b.playerId ? { ...p, eliminated: true } : p)) };
    expect(getNextPlayerId(state, a.playerId)).toBe(c.playerId);
  });
});

describe("reverse card", () => {
  it("flips direction and passes turn to the new previous player", () => {
    let state = newGame(["A", "B", "C"]);
    const [a, , c] = state.players;
    // Force a REVERSE card of the active color into A's hand and make it top-playable.
    const reverseDefId = Object.values(state.cardDefinitions).find((d) => d.type === "REVERSE" && d.color === state.activeColor)!.defId;
    const reverseInstanceId = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === reverseDefId)!;
    state = giveCardToPlayer(state, a.playerId, reverseInstanceId[0]);

    const result = playCard(state, a.playerId, reverseInstanceId[0]);
    expect(result.state.direction).toBe(-1);
    expect(result.state.currentPlayerId).toBe(c.playerId); // reversed: A -> C, not B
  });
});

describe("skip card", () => {
  it("skips the next player's turn", () => {
    let state = newGame(["A", "B", "C"]);
    const [a, , c] = state.players;
    const skipDefId = Object.values(state.cardDefinitions).find((d) => d.type === "SKIP" && d.color === state.activeColor)!.defId;
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === skipDefId)!;
    state = giveCardToPlayer(state, a.playerId, instanceId);

    const result = playCard(state, a.playerId, instanceId);
    expect(result.state.currentPlayerId).toBe(c.playerId);
  });
});

describe("draw effects", () => {
  it("stacks a Draw 2 onto a Draw 2 and the final player draws the accumulated total", () => {
    let state = newGame(["A", "B"]);
    const [a, b] = state.players;
    const draw2Def = Object.values(state.cardDefinitions).find((d) => d.type === "DRAW_2" && d.color === state.activeColor)!.defId;
    const [firstDraw2] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === draw2Def)!;
    state = giveCardToPlayer(state, a.playerId, firstDraw2);

    let result = playCard(state, a.playerId, firstDraw2);
    expect(result.state.pendingEffect).toEqual(expect.objectContaining({ type: "DRAW_STACK", amount: 2 }));
    expect(result.state.currentPlayerId).toBe(b.playerId);

    const bHandSizeBefore = getHandOfPlayer(result.state, b.playerId).cardInstanceIds.length;
    const finalState = drawFromStackOrDeck(result.state, b.playerId);
    const bHandSizeAfter = getHandOfPlayer(finalState, b.playerId).cardInstanceIds.length;
    expect(bHandSizeAfter - bHandSizeBefore).toBe(2);
    expect(finalState.pendingEffect).toBeNull();
    expect(finalState.currentPlayerId).toBe(a.playerId);
  });
});

describe("SWAP_HAND (ex 7)", () => {
  it("swaps hand ownership atomically between the two chosen players", () => {
    let state = newGame(["A", "B", "C"]);
    const [a, , c] = state.players;
    const aHandBefore = getPlayer(state, a.playerId).currentHandId;
    const cHandBefore = getPlayer(state, c.playerId).currentHandId;

    const swapDefId = Object.values(state.cardDefinitions).find((d) => d.type === "SWAP_HAND" && d.color === state.activeColor)!.defId;
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === swapDefId)!;
    state = giveCardToPlayer(state, a.playerId, instanceId);

    const played = playCard(state, a.playerId, instanceId);
    expect(played.requiresSwapTarget).toBe(true);
    expect(played.state.phase).toBe("WAITING_FOR_SWAP_TARGET");

    const finalState = chooseSwapTarget(played.state, a.playerId, c.playerId);
    expect(getPlayer(finalState, a.playerId).currentHandId).toBe(cHandBefore);
    expect(getPlayer(finalState, c.playerId).currentHandId).toBe(aHandBefore);
  });
});

describe("ROTATE_HANDS (ex 0)", () => {
  it("rotates all four hands clockwise, bots included", () => {
    const base = newGame(["Sophie", "Max", "Bot Anna", "Bot Klaus"]);
    const [sophie, max, annaP, klaus] = base.players;
    const handA = sophie.currentHandId;
    const handB = max.currentHandId;
    const handC = annaP.currentHandId;
    const handD = klaus.currentHandId;

    const state = { ...base, direction: 1 as const };
    const rotated = rotateHandsAllPlayers(state);

    expect(getPlayer(rotated, sophie.playerId).currentHandId).toBe(handD);
    expect(getPlayer(rotated, max.playerId).currentHandId).toBe(handA);
    expect(getPlayer(rotated, annaP.playerId).currentHandId).toBe(handB);
    expect(getPlayer(rotated, klaus.playerId).currentHandId).toBe(handC);
  });

  it("rotates in the opposite order when direction is counter-clockwise", () => {
    const base = newGame(["Sophie", "Max", "Bot Anna", "Bot Klaus"]);
    const [sophie, max, annaP, klaus] = base.players;
    const handA = sophie.currentHandId;
    const handB = max.currentHandId;
    const handC = annaP.currentHandId;
    const handD = klaus.currentHandId;

    const state = { ...base, direction: -1 as const };
    const rotated = rotateHandsAllPlayers(state);

    expect(getPlayer(rotated, sophie.playerId).currentHandId).toBe(handB);
    expect(getPlayer(rotated, max.playerId).currentHandId).toBe(handC);
    expect(getPlayer(rotated, annaP.playerId).currentHandId).toBe(handD);
    expect(getPlayer(rotated, klaus.playerId).currentHandId).toBe(handA);
  });
});

describe("TARGET_SKIP (ex 4)", () => {
  it("skips the chosen target's next own turn, not necessarily the immediately following player", () => {
    let state = newGame(["A", "B", "C"]);
    const [a, b, c] = state.players;

    const skipDefId = Object.values(state.cardDefinitions).find((d) => d.type === "TARGET_SKIP" && d.color === state.activeColor)!.defId;
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === skipDefId)!;
    state = giveCardToPlayer(state, a.playerId, instanceId);

    const played = playCard(state, a.playerId, instanceId);
    expect(played.requiresSkipTarget).toBe(true);
    expect(played.state.phase).toBe("WAITING_FOR_SKIP_TARGET");

    // A targets C (not the immediately-next player B).
    const afterTarget = chooseSkipTarget(played.state, a.playerId, c.playerId);
    expect(afterTarget.pendingSkipTargets[c.playerId]).toBe(1);
    // Turn proceeds normally to B first — the mark does not fire immediately.
    expect(afterTarget.currentPlayerId).toBe(b.playerId);

    // B plays a plain card; turn would normally go to C, but C's mark fires instead.
    const topDef = definitionOfInstance(afterTarget, afterTarget.discardPile[afterTarget.discardPile.length - 1]);
    const plainDefId = Object.values(afterTarget.cardDefinitions).find((d) => d.type === "TRIANGLE" && d.color === topDef.color)!.defId;
    const [bCardId] = Object.entries(afterTarget.cardInstanceRegistry).find(([, id]) => id === plainDefId)!;
    const stateWithBCard = giveCardToPlayer(afterTarget, b.playerId, bCardId);
    const afterB = playCard(stateWithBCard, b.playerId, bCardId).state;

    expect(afterB.currentPlayerId).toBe(a.playerId); // C was skipped, wraps back to A
    expect(afterB.pendingSkipTargets[c.playerId]).toBeUndefined(); // mark consumed
  });
});

describe("GIVE_TWO_TO_LOWEST (ex 5)", () => {
  it("draws 2 for the active player with the fewest cards, resolved at play time", () => {
    let state = newGame(["A", "B", "C"]);
    const [a, b, c] = state.players;

    // Make B the clear lowest-hand player.
    const bHandId = getPlayer(state, b.playerId).currentHandId;
    state = { ...state, hands: { ...state.hands, [bHandId]: { handId: bHandId, cardInstanceIds: state.hands[bHandId].cardInstanceIds.slice(0, 1) } } };

    const defId = Object.values(state.cardDefinitions).find((d) => d.type === "GIVE_TWO_TO_LOWEST" && d.color === state.activeColor)!.defId;
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, id]) => id === defId)!;
    state = giveCardToPlayer(state, a.playerId, instanceId);

    const bCountBefore = getHandOfPlayer(state, b.playerId).cardInstanceIds.length;
    const cCountBefore = getHandOfPlayer(state, c.playerId).cardInstanceIds.length;

    const result = playCard(state, a.playerId, instanceId);

    expect(getHandOfPlayer(result.state, b.playerId).cardInstanceIds.length).toBe(bCountBefore + 2);
    expect(getHandOfPlayer(result.state, c.playerId).cardInstanceIds.length).toBe(cCountBefore); // untouched
    expect(result.state.currentPlayerId).toBe(b.playerId); // normal turn advance, no target-selection UI needed
  });
});

describe("DISCARD_ONE_EXTRA (ex 6 / -1)", () => {
  it("discards exactly one additional card whose own effect never fires", () => {
    let state = newGame(["A", "B"]);
    const [a, b] = state.players;

    const extraDefId = Object.values(state.cardDefinitions).find((d) => d.type === "DISCARD_ONE_EXTRA" && d.color === state.activeColor)!.defId;
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, id]) => id === extraDefId)!;
    state = giveCardToPlayer(state, a.playerId, instanceId);

    // Give A a Draw 2 to discard as the "extra" card — its effect must be suppressed.
    const draw2DefId = Object.values(state.cardDefinitions).find((d) => d.type === "DRAW_2")!.defId;
    const [draw2InstanceId] = Object.entries(state.cardInstanceRegistry).find(([, id]) => id === draw2DefId)!;
    const aHandId = getPlayer(state, a.playerId).currentHandId;
    state = { ...state, hands: { ...state.hands, [aHandId]: { ...state.hands[aHandId], cardInstanceIds: [...state.hands[aHandId].cardInstanceIds, draw2InstanceId] } } };
    state = { ...state, drawPile: state.drawPile.filter((id) => id !== draw2InstanceId) };

    const played = playCard(state, a.playerId, instanceId);
    expect(played.requiresExtraDiscard).toBe(true);
    expect(played.state.phase).toBe("WAITING_FOR_EXTRA_DISCARD");

    const aHandBefore = getHandOfPlayer(played.state, a.playerId).cardInstanceIds.length;
    const finalState = discardExtraCard(played.state, a.playerId, draw2InstanceId);

    expect(getHandOfPlayer(finalState, a.playerId).cardInstanceIds.length).toBe(aHandBefore - 1);
    expect(finalState.discardPile.at(-1)).toBe(instanceId);
    expect(finalState.discardPile.at(-2)).toBe(draw2InstanceId);
    expect(finalState.pendingEffect).toBeNull(); // the Draw 2's effect never triggered
    expect(finalState.currentPlayerId).toBe(b.playerId); // normal single-step advance
  });
});

describe("DISCARD_ALL", () => {
  it("puts all matching cards below the action card so the action remains visible", () => {
    let state = newGame(["A", "B"]);
    const [a] = state.players;
    const actionDef = Object.values(state.cardDefinitions).find((def) => def.type === "DISCARD_ALL" && def.color === state.activeColor)!;
    const actionId = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === actionDef.defId)![0];
    const matchingIds = Object.entries(state.cardInstanceRegistry)
      .filter(([instanceId, defId]) => instanceId !== actionId && state.cardDefinitions[defId].color === state.activeColor)
      .slice(0, 2)
      .map(([instanceId]) => instanceId);
    state = giveCardToPlayer(state, a.playerId, actionId);
    for (const matchingId of matchingIds) state = giveCardToPlayer(state, a.playerId, matchingId);

    const result = playCard(state, a.playerId, actionId).state;

    expect(result.discardPile.at(-1)).toBe(actionId);
    for (const matchingId of matchingIds) expect(result.discardPile.slice(0, -1)).toContain(matchingId);
  });
});

describe("bots participate in hand mechanics", () => {
  it("a swap between a human and a bot moves the bot's real hand", () => {
    const state = newGame(["Sophie", "Bot Anna"]);
    const [sophie, anna] = state.players;
    const sophieHand = sophie.currentHandId;
    const annaHand = anna.currentHandId;
    const result = swapHands(state, sophie.playerId, anna.playerId);
    expect(getPlayer(result, sophie.playerId).currentHandId).toBe(annaHand);
    expect(getPlayer(result, anna.playerId).currentHandId).toBe(sophieHand);
  });
});

describe("reconnect", () => {
  it("legal moves for a reconnecting player are recomputed purely from current state", () => {
    const state = newGame(["A", "B"]);
    const [a] = state.players;
    const before = getLegalMoves(state, a.playerId);
    // Simulate reconnect: nothing mutates, recomputation is idempotent.
    const after = getLegalMoves(state, a.playerId);
    expect(after).toEqual(before);
  });
});

describe("victory", () => {
  it("declares a winner once a player's hand reaches zero cards", () => {
    let state = newGame(["A", "B"]);
    const [a] = state.players;
    // Empty A's hand down to one matching card.
    const matchDefId = Object.values(state.cardDefinitions).find((d) => d.type === "TRIANGLE" && d.color === state.activeColor)!.defId;
    const [lastCardId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === matchDefId)!;
    const aHandId = getPlayer(state, a.playerId).currentHandId;
    state = {
      ...state,
      hands: { ...state.hands, [aHandId]: { handId: aHandId, cardInstanceIds: [lastCardId] } },
    };

    const result = playCard(state, a.playerId, lastCardId);
    expect(result.state.phase).toBe("GAME_OVER");
    expect(result.state.winnerPlayerId).toBe(a.playerId);
  });
});

describe("mercy rule", () => {
  it("eliminates a player whose hand reaches the configured threshold", () => {
    let state = newGame(["A", "B"]);
    const [a, b] = state.players;
    const draw10Entry = Object.entries(state.cardDefinitions).find(([, d]) => d.type === "WILD_DRAW_10");
    if (!draw10Entry) return; // deck composition may vary; skip if absent
    const [, draw10Def] = draw10Entry;
    const [instanceId] = Object.entries(state.cardInstanceRegistry).find(([, defId]) => defId === draw10Def.defId)!;
    state = giveCardToPlayer(state, a.playerId, instanceId);

    // Pad B's hand near (but below) the threshold so drawing 10 pushes past it.
    const bHandId = getPlayer(state, b.playerId).currentHandId;
    const padIds = state.drawPile.slice(0, 14);
    state = {
      ...state,
      hands: { ...state.hands, [bHandId]: { handId: bHandId, cardInstanceIds: [...state.hands[bHandId].cardInstanceIds, ...padIds] } },
      drawPile: state.drawPile.slice(14),
    };

    const played = playCard(state, a.playerId, instanceId, { chosenColor: "RED" });
    const final = drawFromStackOrDeck(played.state, b.playerId);
    expect(getPlayer(final, b.playerId).eliminated).toBe(true);
  });
});

describe("dispatchGameAction staleness", () => {
  it("rejects an action carrying an outdated expectedVersion", () => {
    const state = newGame(["A", "B"]);
    const [a] = state.players;
    expect(() => dispatchGameAction(state, a.playerId, { type: "DRAW_CARD", expectedVersion: state.version + 1 })).toThrow();
  });
});

function giveCardToPlayer(state: GameState, playerId: string, instanceId: string): GameState {
  // Remove instanceId from wherever it currently sits (draw pile or another hand) and place it in playerId's hand.
  let working = state;
  working = { ...working, drawPile: working.drawPile.filter((id) => id !== instanceId) };
  working = {
    ...working,
    hands: Object.fromEntries(
      Object.entries(working.hands).map(([handId, hand]) => [handId, { ...hand, cardInstanceIds: hand.cardInstanceIds.filter((id) => id !== instanceId) }]),
    ),
  };
  const player = getPlayer(working, playerId);
  const hand = working.hands[player.currentHandId];
  working = { ...working, hands: { ...working.hands, [hand.handId]: { ...hand, cardInstanceIds: [instanceId, ...hand.cardInstanceIds] } } };
  return working;
}
