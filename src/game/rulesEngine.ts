import { drawAmountOf, isWildDefinition } from "./cards.ts";
import { shuffle } from "./deck.ts";
import { GameError } from "./errors.ts";
import { rotateHandsAllPlayers, swapHands } from "./effects.ts";
import { definitionOfInstance, getHandOfPlayer, getPlayer, topOfDiscard } from "./gameState.ts";
import { advanceTurnConsumingSkips, checkMercyRule, checkWin, getNextPlayerId } from "./turnManager.ts";
import { DEFAULT_RULESET, type CardColor, type CardDefinition, type GameState, type RulesetConfig } from "./types.ts";

/** Whether `card` may legally be played given the current discard/effect state. */
export function isPlayable(card: CardDefinition, state: GameState, ruleset: RulesetConfig = DEFAULT_RULESET): boolean {
  if (state.phase === "GAME_OVER") return false;

  // Under an active draw stack, only cards that extend the stack are legal
  // (if stacking is enabled); everything else must draw instead of playing.
  if (state.pendingEffect?.type === "DRAW_STACK") {
    if (!ruleset.drawStackingEnabled) return false;
    return state.pendingEffect.allowedResponseDefIds.includes(card.defId) || isSameStackFamily(card, state);
  }

  if (isWildDefinition(card)) return true;

  const top = topOfDiscard(state);
  if (!top) return true;

  if (state.activeColor && card.color === state.activeColor) return true;
  // Every non-wild card (plain symbol or action) matches any other card of
  // the exact same type, regardless of color — the old numeric equality
  // check no longer applies since former number cards carry no value.
  if (card.type === top.type) return true;

  return false;
}

function isSameStackFamily(card: CardDefinition, state: GameState): boolean {
  // Any card of matching draw-type may usually be stacked (e.g. Draw 2 on
  // Draw 2). Cross-type stacking (Draw 2 on Wild Draw 4) is
  // TODO_VERIFY_OFFICIAL_RULE and disabled by default here.
  if (state.pendingEffect?.type !== "DRAW_STACK") return false;
  const allowedDefs = state.pendingEffect.allowedResponseDefIds.map((id) => state.cardDefinitions[id]);
  return allowedDefs.some((d) => d.type === card.type);
}

export function getLegalMoves(state: GameState, playerId: string, ruleset: RulesetConfig = DEFAULT_RULESET): string[] {
  const hand = getHandOfPlayer(state, playerId);
  return hand.cardInstanceIds.filter((instanceId) => {
    const def = definitionOfInstance(state, instanceId);
    return isPlayable(def, state, ruleset);
  });
}

function assertTurn(state: GameState, playerId: string) {
  if (state.phase === "GAME_OVER") throw new GameError("GAME_ALREADY_OVER");
  if (state.currentPlayerId !== playerId) throw new GameError("NOT_YOUR_TURN");
}

function bumpVersion(state: GameState): GameState {
  return { ...state, version: state.version + 1 };
}

function removeFromHand(state: GameState, playerId: string, instanceId: string): GameState {
  const player = getPlayer(state, playerId);
  const hand = state.hands[player.currentHandId];
  if (!hand.cardInstanceIds.includes(instanceId)) throw new GameError("CARD_NOT_IN_HAND");
  const newHand = { ...hand, cardInstanceIds: hand.cardInstanceIds.filter((id) => id !== instanceId) };
  return { ...state, hands: { ...state.hands, [newHand.handId]: newHand } };
}

function addToHand(state: GameState, playerId: string, instanceIds: string[]): GameState {
  const player = getPlayer(state, playerId);
  const hand = state.hands[player.currentHandId];
  const newHand = { ...hand, cardInstanceIds: [...hand.cardInstanceIds, ...instanceIds] };
  return { ...state, hands: { ...state.hands, [newHand.handId]: newHand } };
}

/** Reshuffles the discard pile (minus its top card) back into the draw pile when empty. */
function ensureDrawPileHasCards(state: GameState, rng: () => number, needed: number): GameState {
  if (state.drawPile.length >= needed) return state;
  if (state.discardPile.length <= 1) return state; // nothing to reshuffle; caller handles shortage

  const top = state.discardPile[state.discardPile.length - 1];
  const rest = state.discardPile.slice(0, -1);
  const reshuffled = shuffle(rest, rng);
  return { ...state, drawPile: [...state.drawPile, ...reshuffled], discardPile: [top] };
}

function drawInstances(state: GameState, count: number, rng: () => number): { state: GameState; drawn: string[] } {
  let working = ensureDrawPileHasCards(state, rng, count);
  const drawn: string[] = [];
  for (let i = 0; i < count; i++) {
    if (working.drawPile.length === 0) {
      working = ensureDrawPileHasCards(working, rng, 1);
      if (working.drawPile.length === 0) break; // deck truly exhausted; MVP stops short
    }
    const pile = working.drawPile.slice();
    const card = pile.pop()!;
    drawn.push(card);
    working = { ...working, drawPile: pile };
  }
  return { state: working, drawn };
}

export interface PlayCardResult {
  state: GameState;
  requiresColorChoice: boolean;
  requiresSwapTarget: boolean;
  requiresSkipTarget: boolean;
  requiresExtraDiscard: boolean;
}

/**
 * Plays `instanceId` from `playerId`'s hand. Colorless resolution (wild
 * color, swap/skip target, extra discard) is deferred to follow-up actions
 * via phase changes; everything else (skip, reverse, draw effects, hand
 * rotation, win/mercy check, turn advance) resolves immediately and
 * atomically.
 */
export function playCard(
  state: GameState,
  playerId: string,
  instanceId: string,
  options: { chosenColor?: CardColor } = {},
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): PlayCardResult {
  assertTurn(state, playerId);
  if (state.phase !== "WAITING_FOR_PLAY") throw new GameError("WRONG_PHASE");

  const def = definitionOfInstance(state, instanceId);
  if (!isPlayable(def, state, ruleset)) throw new GameError("CARD_NOT_PLAYABLE");

  let working = removeFromHand(state, playerId, instanceId);
  working = { ...working, discardPile: [...working.discardPile, instanceId] };

  if (isWildDefinition(def)) {
    if (!options.chosenColor) {
      // Defer: caller must follow up with CHOOSE_COLOR before the turn advances.
      working = { ...working, phase: "WAITING_FOR_COLOR", activeColor: null };
      return finalizePlay(working, playerId, def, { deferColor: true }, ruleset, rng);
    }
    working = { ...working, activeColor: options.chosenColor };
  } else {
    working = { ...working, activeColor: def.color };
  }

  return finalizePlay(working, playerId, def, {}, ruleset, rng);
}

/** Continuation of playCard() once a WILD card's color is known (chosen or deferred). */
export function chooseColor(
  state: GameState,
  playerId: string,
  color: CardColor,
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): GameState {
  if (state.phase !== "WAITING_FOR_COLOR") throw new GameError("COLOR_NOT_ALLOWED_NOW");
  if (state.currentPlayerId !== playerId) throw new GameError("NOT_YOUR_TURN");
  if (color === "WILD") throw new GameError("COLOR_REQUIRED");

  const topId = state.discardPile[state.discardPile.length - 1];
  const def = definitionOfInstance(state, topId);
  const working = { ...state, activeColor: color, phase: "WAITING_FOR_PLAY" as const };
  const result = finalizePlay(working, playerId, def, {}, ruleset, rng);
  return result.state;
}

function finalizePlay(
  state: GameState,
  playerId: string,
  def: CardDefinition,
  opts: { deferColor?: boolean },
  ruleset: RulesetConfig,
  rng: () => number,
): PlayCardResult {
  let working = bumpVersion(state);

  const winnerId = checkWin(working);
  if (winnerId) {
    working = { ...working, phase: "GAME_OVER", winnerPlayerId: winnerId };
    return { state: working, requiresColorChoice: false, requiresSwapTarget: false, requiresSkipTarget: false, requiresExtraDiscard: false };
  }

  if (opts.deferColor) {
    return { state: working, requiresColorChoice: true, requiresSwapTarget: false, requiresSkipTarget: false, requiresExtraDiscard: false };
  }

  // SWAP_HAND (ex "7"): defer to a follow-up CHOOSE_SWAP_TARGET action.
  if (def.type === "SWAP_HAND" && ruleset.swapHandEnabled) {
    working = { ...working, phase: "WAITING_FOR_SWAP_TARGET", pendingSwapPlayerId: playerId };
    return { state: working, requiresColorChoice: false, requiresSwapTarget: true, requiresSkipTarget: false, requiresExtraDiscard: false };
  }

  // TARGET_SKIP (ex "4"): defer to a follow-up CHOOSE_SKIP_TARGET action.
  // The mark it creates only fires once it would actually be the target's turn.
  if (def.type === "TARGET_SKIP") {
    working = { ...working, phase: "WAITING_FOR_SKIP_TARGET", pendingSkipPlayerId: playerId };
    return { state: working, requiresColorChoice: false, requiresSwapTarget: false, requiresSkipTarget: true, requiresExtraDiscard: false };
  }

  // DISCARD_ONE_EXTRA (ex "6" / "-1"): defer to a follow-up DISCARD_EXTRA_CARD
  // action; the turn does not advance until that second card is discarded.
  if (def.type === "DISCARD_ONE_EXTRA") {
    working = { ...working, phase: "WAITING_FOR_EXTRA_DISCARD", pendingExtraDiscardPlayerId: playerId };
    return { state: working, requiresColorChoice: false, requiresSwapTarget: false, requiresSkipTarget: false, requiresExtraDiscard: true };
  }

  // ROTATE_HANDS (ex "0"): rotate all hands immediately, then advance turn normally.
  if (def.type === "ROTATE_HANDS" && ruleset.rotateHandsEnabled) {
    working = rotateHandsAllPlayers(working);
  }

  working = applyImmediateEffectsAndAdvance(working, playerId, def, ruleset, rng);
  working = applyMercyRule(working, ruleset);
  return { state: working, requiresColorChoice: false, requiresSwapTarget: false, requiresSkipTarget: false, requiresExtraDiscard: false };
}

export function chooseSwapTarget(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): GameState {
  if (state.phase !== "WAITING_FOR_SWAP_TARGET") throw new GameError("WRONG_PHASE");
  if (state.pendingSwapPlayerId !== playerId) throw new GameError("NOT_YOUR_TURN");
  const target = state.players.find((p) => p.playerId === targetPlayerId);
  if (!target || target.eliminated || target.playerId === playerId) throw new GameError("INVALID_SWAP_TARGET");

  let working = swapHands(state, playerId, targetPlayerId);
  working = { ...working, pendingSwapPlayerId: null, phase: "WAITING_FOR_PLAY" };
  const topId = working.discardPile[working.discardPile.length - 1];
  const def = definitionOfInstance(working, topId);
  working = applyImmediateEffectsAndAdvance(working, playerId, def, ruleset, rng);
  working = applyMercyRule(working, ruleset);
  return working;
}

/**
 * Resolves a TARGET_SKIP card's chosen target: marks that player to have
 * their next own turn skipped (not necessarily the immediately following
 * player — the mark is consumed whenever it would actually become their
 * turn, see turnManager.advanceTurnConsumingSkips) and advances the turn.
 */
export function chooseSkipTarget(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): GameState {
  if (state.phase !== "WAITING_FOR_SKIP_TARGET") throw new GameError("WRONG_PHASE");
  if (state.pendingSkipPlayerId !== playerId) throw new GameError("NOT_YOUR_TURN");
  const target = state.players.find((p) => p.playerId === targetPlayerId);
  if (!target || target.eliminated) throw new GameError("INVALID_SKIP_TARGET");

  let working: GameState = {
    ...state,
    pendingSkipTargets: { ...state.pendingSkipTargets, [targetPlayerId]: (state.pendingSkipTargets[targetPlayerId] ?? 0) + 1 },
    pendingSkipPlayerId: null,
    phase: "WAITING_FOR_PLAY",
  };
  const topId = working.discardPile[working.discardPile.length - 1];
  const def = definitionOfInstance(working, topId);
  working = applyImmediateEffectsAndAdvance(working, playerId, def, ruleset, rng);
  working = applyMercyRule(working, ruleset);
  return working;
}

/**
 * Resolves DISCARD_ONE_EXTRA's second, wirkungslos discard: the chosen card
 * is removed from hand and placed on the discard pile, but — critically —
 * never runs through playCard/applyImmediateEffectsAndAdvance, so it can
 * never trigger its own effect, color choice, or stacking.
 */
export function discardExtraCard(
  state: GameState,
  playerId: string,
  cardInstanceId: string,
  ruleset: RulesetConfig = DEFAULT_RULESET,
  _rng: () => number = Math.random,
): GameState {
  if (state.phase !== "WAITING_FOR_EXTRA_DISCARD") throw new GameError("WRONG_PHASE");
  if (state.pendingExtraDiscardPlayerId !== playerId) throw new GameError("NOT_YOUR_TURN");

  let working = removeFromHand(state, playerId, cardInstanceId);
  const actionCardId = working.discardPile.at(-1);
  if (!actionCardId) throw new Error("EMPTY_DISCARD_PILE");
  // The extra card is discarded without becoming the visible top card. The
  // action card remains on top so the table still communicates which effect
  // was resolved and matching continues against that action card.
  working = { ...working, discardPile: [...working.discardPile.slice(0, -1), cardInstanceId, actionCardId] };
  working = { ...working, pendingExtraDiscardPlayerId: null, phase: "WAITING_FOR_PLAY" };
  working = bumpVersion(working);

  const winnerId = checkWin(working);
  if (winnerId) {
    return { ...working, phase: "GAME_OVER", winnerPlayerId: winnerId };
  }

  const { playerId: nextPlayerId, pendingSkipTargets } = advanceTurnConsumingSkips(working, playerId, 1);
  working = { ...working, currentPlayerId: nextPlayerId, pendingSkipTargets, turnNumber: working.turnNumber + 1, phase: "WAITING_FOR_PLAY" };
  working = applyMercyRule(working, ruleset);
  return working;
}

function applyImmediateEffectsAndAdvance(
  state: GameState,
  playerId: string,
  def: CardDefinition,
  ruleset: RulesetConfig,
  rng: () => number,
): GameState {
  let working = state;
  let stepsToAdvance = 1;
  let reverseDirection = false;

  switch (def.type) {
    case "SKIP":
      stepsToAdvance = 2;
      break;
    case "SKIP_EVERYONE": {
      // Everyone except the player who played it is skipped once.
      const count = working.players.filter((p) => !p.eliminated).length;
      stepsToAdvance = count;
      break;
    }
    case "REVERSE":
      reverseDirection = true;
      break;
    case "GIVE_TWO_TO_LOWEST":
      working = applyGiveTwoToLowest(working, rng);
      break;
    case "DRAW_1":
    case "DRAW_2":
    case "WILD_DRAW_4":
    case "WILD_DRAW_6":
    case "WILD_DRAW_10":
      working = applyDrawEffect(working, playerId, def, ruleset, rng);
      // If stacking passed the buck (pendingEffect set), don't advance past
      // the recipient — they must respond before the turn truly moves on.
      if (working.pendingEffect) {
        const { playerId: nextId, pendingSkipTargets } = advanceTurnConsumingSkips(working, playerId, 1);
        return { ...working, currentPlayerId: nextId, pendingSkipTargets };
      }
      stepsToAdvance = 2; // drawer is skipped after drawing
      break;
    case "WILD_REVERSE_DRAW_4":
      reverseDirection = true;
      working = applyDrawEffect(working, playerId, def, ruleset, rng);
      if (working.pendingEffect) {
        working = { ...working, direction: (working.direction * -1) as 1 | -1 };
        const { playerId: nextId, pendingSkipTargets } = advanceTurnConsumingSkips(working, playerId, 1);
        return { ...working, currentPlayerId: nextId, pendingSkipTargets };
      }
      stepsToAdvance = 2;
      break;
    case "DISCARD_ALL": {
      // Discards every card of the active color from the player's hand.
      working = applyDiscardAll(working, playerId);
      break;
    }
    default:
      break;
  }

  if (reverseDirection) {
    working = { ...working, direction: (working.direction * -1) as 1 | -1 };
  }

  const { playerId: nextPlayerId, pendingSkipTargets } = advanceTurnConsumingSkips(working, playerId, stepsToAdvance);
  working = {
    ...working,
    currentPlayerId: nextPlayerId,
    pendingSkipTargets,
    turnNumber: working.turnNumber + 1,
    phase: "WAITING_FOR_PLAY",
  };
  return working;
}

/**
 * GIVE_TWO_TO_LOWEST (ex "5"): the active player with the fewest cards at
 * resolution time draws 2, immediately and unconditionally (not stacked).
 * Ties: TODO_DEFINE_LOWEST_HAND_TIE_RULE — the brief explicitly forbids
 * inventing a rule here, so ties are broken deterministically by seat order
 * as a placeholder only.
 */
function applyGiveTwoToLowest(state: GameState, rng: () => number): GameState {
  const active = state.players.filter((p) => !p.eliminated);
  if (active.length === 0) return state;

  let lowest = active[0];
  for (const p of active) {
    const count = state.hands[p.currentHandId].cardInstanceIds.length;
    const lowestCount = state.hands[lowest.currentHandId].cardInstanceIds.length;
    if (count < lowestCount) lowest = p;
  }

  const { state: drawnState, drawn } = drawInstances(state, 2, rng);
  return addToHand(drawnState, lowest.playerId, drawn);
}

function applyDrawEffect(state: GameState, playerId: string, def: CardDefinition, ruleset: RulesetConfig, rng: () => number): GameState {
  const amount = drawAmountOf(def);
  const nextId = getNextPlayerId(state, playerId, 1);

  if (ruleset.drawStackingEnabled) {
    const family = sameFamilyDefIds(state, def);
    const existing = state.pendingEffect?.type === "DRAW_STACK" ? state.pendingEffect.amount : 0;
    return {
      ...state,
      pendingEffect: { type: "DRAW_STACK", amount: existing + amount, sourcePlayerId: playerId, allowedResponseDefIds: family },
    };
  }

  const { state: drawn, drawn: instanceIds } = drawInstances(state, amount, rng);
  return addToHand(drawn, nextId, instanceIds);
}

function sameFamilyDefIds(state: GameState, def: CardDefinition): string[] {
  return Object.values(state.cardDefinitions)
    .filter((d) => d.type === def.type)
    .map((d) => d.defId);
}

function applyDiscardAll(state: GameState, playerId: string): GameState {
  if (!state.activeColor) return state;
  const player = getPlayer(state, playerId);
  const hand = state.hands[player.currentHandId];
  const toDiscard = hand.cardInstanceIds.filter((id) => definitionOfInstance(state, id).color === state.activeColor);
  const remaining = hand.cardInstanceIds.filter((id) => !toDiscard.includes(id));
  const newHand = { ...hand, cardInstanceIds: remaining };
  const actionCardId = state.discardPile.at(-1);
  if (!actionCardId) return state;
  return {
    ...state,
    hands: { ...state.hands, [newHand.handId]: newHand },
    // All matching cards go underneath the action card so DISCARD_ALL stays
    // visible and remains the matching reference for the next player.
    discardPile: [...state.discardPile.slice(0, -1), ...toDiscard, actionCardId],
  };
}

/**
 * Resolves a pending draw stack for `playerId` by taking the accumulated
 * penalty instead of playing a stackable card.
 */
export function drawFromStackOrDeck(
  state: GameState,
  playerId: string,
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): GameState {
  assertTurn(state, playerId);
  if (state.phase !== "WAITING_FOR_PLAY") throw new GameError("WRONG_PHASE");

  const amount = state.pendingEffect?.type === "DRAW_STACK" ? state.pendingEffect.amount : 1;
  const { state: drawnState, drawn } = drawInstances(state, amount, rng);
  let working = addToHand(drawnState, playerId, drawn);
  working = { ...working, pendingEffect: null };
  working = bumpVersion(working);

  const { playerId: nextPlayerId, pendingSkipTargets } = advanceTurnConsumingSkips(working, playerId, 1);
  working = { ...working, currentPlayerId: nextPlayerId, pendingSkipTargets, turnNumber: working.turnNumber + 1, phase: "WAITING_FOR_PLAY" };
  working = applyMercyRule(working, ruleset);
  return working;
}

function applyMercyRule(state: GameState, ruleset: RulesetConfig): GameState {
  if (!ruleset.mercyRuleEnabled) return state;
  const eliminatedIds = checkMercyRule(state, ruleset.mercyRuleCardCountThreshold);
  if (eliminatedIds.length === 0) return state;
  const players = state.players.map((p) => (eliminatedIds.includes(p.playerId) ? { ...p, eliminated: true } : p));
  let working = { ...state, players };

  const remaining = working.players.filter((p) => !p.eliminated);
  if (remaining.length === 1) {
    working = { ...working, phase: "GAME_OVER", winnerPlayerId: remaining[0].playerId };
  }
  return working;
}
