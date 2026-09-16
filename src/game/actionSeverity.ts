// Classifies a playback beat into exactly one of the two visual action
// stages the UI brief calls for (Standard Action Focus / Major Action
// Focus), or NONE for a plain matching-card play that gets no dedicated
// stage at all. This is presentation-only classification — it reads the
// already-resolved beat/card data, it never decides game behavior.
import type { CardType } from "./types";
import type { PlaybackBeat } from "../multiplayer/playbackBeats";

export type ActionSeverity = "NONE" | "STANDARD" | "MAJOR";

const MAJOR_CARD_TYPES: CardType[] = [
  "SWAP_HAND",
  "ROTATE_HANDS",
  "SKIP_EVERYONE",
  "WILD_DRAW_10",
  "WILD_COLOR_ROULETTE",
  "WILD_REVERSE_DRAW_4",
];

const STANDARD_CARD_TYPES: CardType[] = [
  "TARGET_SKIP",
  "GIVE_TWO_TO_LOWEST",
  "DRAW_2",
  "DRAW_4",
  "SKIP",
  "REVERSE",
  "DISCARD_ALL",
  "WILD",
  "WILD_DRAW_4",
];

/** Max on-screen duration per severity, per the brief: Standard ~1-2.5s, Major up to ~5s. */
export const SEVERITY_DURATION_MS: Record<ActionSeverity, { min: number; max: number }> = {
  NONE: { min: 0, max: 550 },
  STANDARD: { min: 1000, max: 2500 },
  MAJOR: { min: 1600, max: 5000 },
};

export function classifyBeatSeverity(beat: PlaybackBeat): ActionSeverity {
  if (beat.kind === "SWAP" || beat.kind === "ROTATE") return "MAJOR";
  if (beat.kind === "SKIP" || beat.kind === "STACK" || beat.kind === "COLOR") return "STANDARD";
  if (beat.kind === "ELIMINATED" || beat.kind === "GAME_OVER") return "STANDARD";
  if (beat.kind === "DRAW") return beat.totalAmount ? "STANDARD" : "NONE"; // a lone forced draw isn't a spectacle
  if (beat.kind === "EXTRA") return "NONE"; // DITCH's extra card must never trigger its own focus stage
  if (beat.kind === "PLAY" && beat.card) {
    if (MAJOR_CARD_TYPES.includes(beat.card.type)) return "MAJOR";
    if (STANDARD_CARD_TYPES.includes(beat.card.type)) return "STANDARD";
  }
  return "NONE"; // plain Basic/Core-matching card: just lands on the pile
}

export function clampDurationForSeverity(durationMs: number, severity: ActionSeverity): number {
  const { min, max } = SEVERITY_DURATION_MS[severity];
  return Math.min(max, Math.max(min, durationMs));
}
