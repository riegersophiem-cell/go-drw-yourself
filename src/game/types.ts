// Core domain types. Device, Player and Hand are kept as separate entities on purpose:
// hand ownership must be reassignable (7-swap, 0-rotation) without moving physical cards.

export type CardColor = "RED" | "BLUE" | "GREEN" | "YELLOW" | "WILD";

// The former 0-9 number cards carry no visible digits any more (per the
// UI/UX brief). Five of the ten slots are plain symbol cards with no special
// effect (TRIANGLE/SQUARE/CIRCLE/DIAMOND/SEMICIRCLE, ex 1/2/3/8/9); the other
// five carry the effects the old numbers never had (ex 0/4/5/6/7).
export type CardType =
  | "TRIANGLE" // ex "1" — plain symbol card
  | "SQUARE" // ex "2" — plain symbol card
  | "CIRCLE" // ex "3" — plain symbol card
  | "DIAMOND" // ex "8" — plain symbol card
  | "SEMICIRCLE" // ex "9" — plain symbol card
  | "ROTATE_HANDS" // ex "0" — all active players pass their whole hand along in turn direction
  | "TARGET_SKIP" // ex "4" — chosen player's *next own turn* is skipped (persists until then)
  | "GIVE_TWO_TO_LOWEST" // ex "5" — the active player with the fewest cards draws 2, resolved automatically
  | "DISCARD_ONE_EXTRA" // ex "6" (shown as "-1") — play, then discard one more card from hand with no effect
  | "SWAP_HAND" // ex "7" — swap entire hand with a chosen player
  | "SKIP"
  | "REVERSE"
  | "DRAW_1"
  | "DRAW_2"
  | "WILD"
  | "WILD_DRAW_4"
  | "WILD_DRAW_6"
  | "WILD_DRAW_10"
  | "SKIP_EVERYONE"
  | "DISCARD_ALL"
  | "WILD_REVERSE_DRAW_4"
  | "WILD_COLOR_ROULETTE";

/** Plain former-number symbol cards with no special effect — match like any other card by color or type. */
export const PLAIN_SYMBOL_TYPES: CardType[] = ["TRIANGLE", "SQUARE", "CIRCLE", "DIAMOND", "SEMICIRCLE"];

// A card definition is the abstract "kind" of card (e.g. "Red Triangle").
export interface CardDefinition {
  defId: string;
  color: CardColor;
  type: CardType;
}

// A card instance is one physical card in the deck, tracked individually so it
// can move between drawPile / discardPile / hands without ever duplicating.
export interface CardInstance {
  instanceId: string;
  defId: string;
}

export type PlayerType = "HUMAN" | "BOT";

export interface Player {
  playerId: string;
  displayName: string;
  type: PlayerType;
  seatIndex: number;
  currentHandId: string;
  connected: boolean;
  eliminated: boolean;
  botStrategyLevel?: "EASY" | "NORMAL";
}

export interface Hand {
  handId: string;
  cardInstanceIds: string[];
}

export type DeviceRole = "PLAYER" | "TABLE" | "SPECTATOR" | "HOST_ADMIN";

export interface Device {
  deviceId: string;
  roomId: string;
  role: DeviceRole;
  playerId?: string; // set only for role === PLAYER
  sessionTokenHash: string;
  connected: boolean;
  lastSeenAt: string;
}

export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";

export interface Room {
  roomId: string;
  roomCode: string;
  status: RoomStatus;
  hostDeviceId: string;
  createdAt: string;
}

export type Direction = 1 | -1;

export type TurnPhase =
  | "WAITING_FOR_PLAY"
  | "WAITING_FOR_DRAW_DECISION"
  | "WAITING_FOR_COLOR"
  | "WAITING_FOR_SWAP_TARGET"
  | "WAITING_FOR_SKIP_TARGET"
  | "WAITING_FOR_EXTRA_DISCARD"
  | "RESOLVING_EFFECT"
  | "BOT_THINKING"
  | "GAME_OVER";

export type PendingEffect =
  | { type: "DRAW_STACK"; amount: number; sourcePlayerId: string; allowedResponseDefIds: string[] }
  | { type: "SKIP_EVERYONE" }
  | null;

export interface GameState {
  roomId: string;
  gameId: string;
  version: number;
  turnNumber: number;
  direction: Direction;
  phase: TurnPhase;
  currentPlayerId: string;
  players: Player[]; // ordered by seatIndex
  hands: Record<string, Hand>; // handId -> Hand
  drawPile: string[]; // instanceIds, top of pile = last element
  discardPile: string[]; // instanceIds, top of pile = last element
  cardDefinitions: Record<string, CardDefinition>; // defId -> definition
  cardInstanceRegistry: Record<string, string>; // instanceId -> defId, for the whole deck's lifetime
  activeColor: CardColor | null; // color currently in play (resolves WILD)
  pendingEffect: PendingEffect;
  pendingSwapPlayerId: string | null; // player who played a SWAP_HAND card, awaiting target choice
  pendingSkipPlayerId: string | null; // player who played a TARGET_SKIP card, awaiting target choice
  pendingExtraDiscardPlayerId: string | null; // player who played DISCARD_ONE_EXTRA, awaiting the extra card
  pendingSkipTargets: Record<string, number>; // playerId -> number of upcoming turns to skip (persists until consumed, survives reconnect)
  winnerPlayerId: string | null;
}

// ---- Projections sent to clients (never the full GameState) ----

export interface PublicPlayerView {
  playerId: string;
  displayName: string;
  type: PlayerType;
  seatIndex: number;
  cardCount: number;
  connected: boolean;
  eliminated: boolean;
}

export interface PublicGameState {
  roomId: string;
  gameId: string;
  version: number;
  status: RoomStatus;
  direction: Direction;
  phase: TurnPhase;
  currentPlayerId: string;
  players: PublicPlayerView[];
  topDiscard: CardDefinition | null;
  activeColor: CardColor | null;
  pendingEffect: PendingEffect;
  pendingSkipTargets: Record<string, number>; // public: whose next turn(s) are already marked to be skipped
  drawPileCount: number;
  winnerPlayerId: string | null;
}

export interface OwnHandCard {
  instanceId: string;
  def: CardDefinition;
}

export interface PrivatePlayerState {
  playerId: string;
  ownHand: OwnHandCard[]; // resolved from own hand's card instances, instanceId kept for PLAY_CARD targeting
  legalMoves: string[]; // instanceIds of currently playable cards
  publicState: PublicGameState;
}

// ---- Ruleset configuration (kept explicit; unclear official rules are gated here) ----

export interface RulesetConfig {
  swapHandEnabled: boolean; // TODO_VERIFY_OFFICIAL_RULE
  rotateHandsEnabled: boolean; // TODO_VERIFY_OFFICIAL_RULE
  drawStackingEnabled: boolean; // TODO_VERIFY_OFFICIAL_RULE
  mercyRuleEnabled: boolean; // TODO_VERIFY_OFFICIAL_RULE: exact threshold unclear
  mercyRuleCardCountThreshold: number;
  startingHandSize: number;
}

export const DEFAULT_RULESET: RulesetConfig = {
  swapHandEnabled: true,
  rotateHandsEnabled: true,
  drawStackingEnabled: true,
  mercyRuleEnabled: true,
  mercyRuleCardCountThreshold: 25,
  startingHandSize: 7,
};
