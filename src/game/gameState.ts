import { buildStandardDeck, isWildDefinition } from "./cards.ts";
import { instantiateDeck, shuffle } from "./deck.ts";
import {
  DEFAULT_RULESET,
  PLAIN_SYMBOL_TYPES,
  type CardDefinition,
  type GameState,
  type Hand,
  type Player,
  type PlayerType,
  type PublicGameState,
  type PublicPlayerView,
  type RulesetConfig,
} from "./types.ts";

let handCounter = 0;
function nextHandId(): string {
  handCounter += 1;
  return `hand_${handCounter}`;
}

export interface NewPlayerSpec {
  playerId: string;
  displayName: string;
  type: PlayerType;
  botStrategyLevel?: "EASY" | "NORMAL";
}

/**
 * Deals a fresh game. Pure function of its inputs (rng injectable for tests)
 * so outcomes are deterministic and reproducible.
 */
export function createNewGame(
  roomId: string,
  playerSpecs: NewPlayerSpec[],
  ruleset: RulesetConfig = DEFAULT_RULESET,
  rng: () => number = Math.random,
): GameState {
  if (playerSpecs.length < 2) {
    throw new Error("A game requires at least 2 players.");
  }

  const definitions = buildStandardDeck();
  const cardDefinitions: Record<string, CardDefinition> = {};
  for (const def of definitions) cardDefinitions[def.defId] = def;

  const allInstances = shuffle(instantiateDeck(definitions), rng);
  const cardInstanceRegistry: Record<string, string> = {};
  for (const inst of allInstances) cardInstanceRegistry[inst.instanceId] = inst.defId;

  const hands: Record<string, Hand> = {};
  const players: Player[] = [];
  let cursor = 0;

  playerSpecs.forEach((spec, seatIndex) => {
    const dealt = allInstances.slice(cursor, cursor + ruleset.startingHandSize);
    cursor += ruleset.startingHandSize;
    const handId = nextHandId();
    hands[handId] = { handId, cardInstanceIds: dealt.map((c) => c.instanceId) };
    players.push({
      playerId: spec.playerId,
      displayName: spec.displayName,
      type: spec.type,
      seatIndex,
      currentHandId: handId,
      connected: true,
      eliminated: false,
      botStrategyLevel: spec.botStrategyLevel,
    });
  });

  let remaining = allInstances.slice(cursor);

  // Flip the first plain symbol card (no action attached) to start the
  // discard pile so the opening color is determined and no effect fires
  // before anyone has taken a turn.
  let startIndex = remaining.findIndex((c) => {
    const def = cardDefinitions[c.defId];
    return !isWildDefinition(def) && PLAIN_SYMBOL_TYPES.includes(def.type);
  });
  if (startIndex === -1) startIndex = 0;
  const startCard = remaining[startIndex];
  remaining = [...remaining.slice(0, startIndex), ...remaining.slice(startIndex + 1)];
  const startDef = cardDefinitions[startCard.defId];

  return {
    roomId,
    version: 1,
    turnNumber: 1,
    direction: 1,
    phase: "WAITING_FOR_PLAY",
    currentPlayerId: players[0].playerId,
    players,
    hands,
    drawPile: remaining.map((c) => c.instanceId),
    discardPile: [startCard.instanceId],
    cardDefinitions,
    cardInstanceRegistry,
    activeColor: startDef.color === "WILD" ? null : startDef.color,
    pendingEffect: null,
    pendingSwapPlayerId: null,
    pendingSkipPlayerId: null,
    pendingExtraDiscardPlayerId: null,
    pendingSkipTargets: {},
    winnerPlayerId: null,
  };
}

export function getPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

export function getHandOfPlayer(state: GameState, playerId: string): Hand {
  const player = getPlayer(state, playerId);
  return state.hands[player.currentHandId];
}

export function definitionOfInstance(state: GameState, instanceId: string): CardDefinition {
  const defId = state.cardInstanceRegistry[instanceId];
  if (!defId) throw new Error(`Unknown card instance ${instanceId}`);
  return state.cardDefinitions[defId];
}

export function resolveHandToCards(state: GameState, hand: Hand): CardDefinition[] {
  return hand.cardInstanceIds.map((instanceId) => definitionOfInstance(state, instanceId));
}

export function topOfDiscard(state: GameState): CardDefinition | null {
  const topId = state.discardPile[state.discardPile.length - 1];
  if (!topId) return null;
  return definitionOfInstance(state, topId);
}

export function toPublicPlayerView(state: GameState, player: Player): PublicPlayerView {
  return {
    playerId: player.playerId,
    displayName: player.displayName,
    type: player.type,
    seatIndex: player.seatIndex,
    cardCount: state.hands[player.currentHandId].cardInstanceIds.length,
    connected: player.connected,
    eliminated: player.eliminated,
  };
}

export function toPublicGameState(state: GameState, status: PublicGameState["status"] = "PLAYING"): PublicGameState {
  return {
    roomId: state.roomId,
    version: state.version,
    status,
    direction: state.direction,
    phase: state.phase,
    currentPlayerId: state.currentPlayerId,
    players: state.players.map((p) => toPublicPlayerView(state, p)),
    topDiscard: topOfDiscard(state),
    activeColor: state.activeColor,
    pendingEffect: state.pendingEffect,
    pendingSkipTargets: state.pendingSkipTargets,
    drawPileCount: state.drawPile.length,
    winnerPlayerId: state.winnerPlayerId,
  };
}
