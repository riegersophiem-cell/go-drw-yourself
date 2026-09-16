// Core domain types. Device, Player and Hand are kept as separate entities on purpose:
// hand ownership must be reassignable (7-swap, 0-rotation) without moving physical cards.

import type { AvatarId } from "./avatars.ts";

// 5 regular play colors (RED/BLUE/GREEN/YELLOW/VIOLET) plus WILD, the marker
// for a colorless/chaos card whose color is chosen at play time (see
// isWildDefinition() in cards.ts). VIOLET is a full regular color: every
// place that matches, validates, deals, or lets a player/bot choose a
// color must treat it exactly like RED/BLUE/GREEN/YELLOW - never assume
// there are exactly 4.
export type CardColor = "RED" | "BLUE" | "GREEN" | "YELLOW" | "VIOLET" | "WILD";

// The former 0-9 number cards carry no visible digits any more (per the
// UI/UX brief). Internal type identifiers remain stable for persisted-game
// compatibility; player-facing names and asset slugs live in cardArt.ts.
//
// BASIC (4 types, in-game display names PASS/LINK/PULSE/ARC): TRIANGLE,
// SQUARE, CIRCLE, SEMICIRCLE. Pure matching cards, no effect,
// 5 colors x 4 copies = 20 each, 80 total. See PLAIN_SYMBOL_TYPES.
//
// CORE ACTION (4 types, display names SHOVE/TARGET/LOWEST/DITCH): DIAMOND,
// TARGET_SKIP, GIVE_TWO_TO_LOWEST, DISCARD_ONE_EXTRA. 5 colors x 2 copies =
// 10 each, 40 total. See CORE_ACTION_TYPES. DIAMOND/SHOVE moved here from the
// old plain-symbol grouping — it has no defined effect yet, see
// TODO_DEFINE_SHOVE_EFFECT at its rule-engine touch point (there isn't one:
// it currently behaves as a pure matching card, same as a Basic card, until
// an official effect is defined).
//
// CHAOS (display names SWAP/ROTATE/SKIP ALL/REVERSE +4/WILD DRAW 6/WILD DRAW
// 10/COLOR ROULETTE, plus plain WILD and WILD DRAW 4): SWAP_HAND,
// ROTATE_HANDS, SKIP_EVERYONE, WILD_REVERSE_DRAW_4, WILD_DRAW_6,
// WILD_DRAW_10, WILD_COLOR_ROULETTE, WILD, WILD_DRAW_4. Colorless
// (color: "WILD") — no fixed regular starting color, always playable, and
// resolving one always requires picking a new regular active color first
// (the existing WAITING_FOR_COLOR phase machinery in rulesEngine.ts, see
// isWildDefinition()). SWAP_HAND and ROTATE_HANDS moved here from being
// per-color cards; SKIP_EVERYONE/the other WILD_* types were colorless
// already. See CHAOS_TYPES.
//
// Two colored (non-chaos) action types match by their own printed color like
// any Basic/Core Action card and need no color choice: DRAW_1, DRAW_2,
// SKIP, REVERSE, DISCARD_ALL, and the newer DRAW_4 (a plain colored "draw
// four", distinct from the colorless WILD_DRAW_4 above).
export type CardType =
  | "TRIANGLE" // ex "1" — Basic/PASS
  | "SQUARE" // ex "2" — Basic/LINK
  | "CIRCLE" // ex "3" — Basic/PULSE
  | "DIAMOND" // ex "8" — Core Action/SHOVE — TODO_DEFINE_SHOVE_EFFECT (no effect defined; behaves as a pure matching card)
  | "SEMICIRCLE" // ex "9" — Basic/ARC
  | "ROTATE_HANDS" // ex "0" — Chaos/ROTATE — all active players pass their whole hand along in turn direction, after a mandatory color choice
  | "TARGET_SKIP" // ex "4" — Core Action/TARGET — chosen player's *next own turn* is skipped (persists until then)
  | "GIVE_TWO_TO_LOWEST" // ex "5" — Core Action/LOWEST — the active player with the fewest cards draws 2, resolved automatically
  | "DISCARD_ONE_EXTRA" // ex "6" (shown as "-1") — Core Action/DITCH — play, then discard one more card from hand with no effect
  | "SWAP_HAND" // ex "7" — Chaos/SWAP — swap entire hand with a chosen player, after a mandatory color choice
  | "SKIP"
  | "REVERSE"
  | "DRAW_1"
  | "DRAW_2"
  | "DRAW_4" // plain colored Draw Four — distinct from the colorless Chaos WILD_DRAW_4 below
  | "WILD"
  | "WILD_DRAW_4"
  | "WILD_DRAW_6"
  | "WILD_DRAW_10"
  | "SKIP_EVERYONE" // Chaos/SKIP ALL — mandatory color choice, skips every other active player, then the same player immediately plays again under the chosen color
  | "DISCARD_ALL"
  | "WILD_REVERSE_DRAW_4"
  | "WILD_COLOR_ROULETTE";

/** The 4 Basic card types (in-game names PASS/LINK/PULSE/ARC) — pure matching cards with no effect. */
export const PLAIN_SYMBOL_TYPES: CardType[] = ["TRIANGLE", "SQUARE", "CIRCLE", "SEMICIRCLE"];

/** The 4 Core Action card types (in-game names SHOVE/TARGET/LOWEST/DITCH) — regular colors, no color choice. */
export const CORE_ACTION_TYPES: CardType[] = ["DIAMOND", "TARGET_SKIP", "GIVE_TWO_TO_LOWEST", "DISCARD_ONE_EXTRA"];

/** The Chaos card family — colorless (color: "WILD"), always playable, mandatory color choice on resolution. */
export const CHAOS_TYPES: CardType[] = [
  "SWAP_HAND",
  "ROTATE_HANDS",
  "SKIP_EVERYONE",
  "WILD_REVERSE_DRAW_4",
  "WILD_DRAW_6",
  "WILD_DRAW_10",
  "WILD_COLOR_ROULETTE",
  "WILD",
  "WILD_DRAW_4",
];

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
  avatar: AvatarId;
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
  | {
      type: "DRAW_STACK";
      amount: number; // cumulative total the eventual drawer will take
      lastDrawValue: number; // the most recently played card's own draw value — toppers must be >= this, never compared against `amount`
      terminal: boolean; // once true (a Chaos terminal draw was played), no further card may top the stack — see ACTION_CHAOS_LIFECYCLE_REPORT.md section 8
      sourcePlayerId: string;
    }
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
  avatar: AvatarId;
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
