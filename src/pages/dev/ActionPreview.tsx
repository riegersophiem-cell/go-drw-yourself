// DEV-ONLY visual QA harness — never reachable in production (see App.tsx,
// which only registers this route when import.meta.env.DEV is true, and
// Vite dead-code-eliminates the whole branch — including this file's import
// — from a production build). Renders GameTable directly against a
// hand-built PublicGameState + a synthetic PlaybackBeat, completely
// bypassing Supabase/the rule engine, so every Action Focus state (however
// rare its triggering card is in a real deck) can be reproduced instantly
// and deterministically for screenshotting instead of waiting on random bot
// play. See ACTION_FOCUS_POLISH_REPORT.md section "Deterministic QA".
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GameTable } from "../../components/GameTable/GameTable";
import type { CardColor, CardType, Direction, PendingEffect, PublicGameState, PublicPlayerView } from "../../game/types";
import type { PlaybackBeat, PlaybackBeatKind } from "../../multiplayer/playbackBeats";

const NAMES = ["Sophie", "Bot 2", "Bot 3", "Bot 4", "Bot 5", "Bot 6"];
const AVATARS = ["H01", "BOT1", "BOT2", "BOT3", "BOT4", "BOT5"] as const;

function makePlayers(count: number): PublicPlayerView[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i}`,
    displayName: NAMES[i] ?? `Bot ${i + 1}`,
    type: i === 0 ? "HUMAN" : "BOT",
    avatar: AVATARS[i % AVATARS.length],
    seatIndex: i,
    cardCount: 7 + i,
    connected: true,
    eliminated: false,
  }));
}

interface Scenario {
  beat: PlaybackBeat | null;
  discard: { color: CardColor; type: CardType };
  activeColor: CardColor;
  currentPlayerIndex: number;
  pendingEffect?: PendingEffect;
  pendingSkipTargets?: Record<string, number>;
  direction?: Direction;
  flipDirectionAfterMs?: number; // simulates a live REVERSE for OrbitFlow's own reversing-detector
}

function beatBase(kind: PlaybackBeatKind, extra: Partial<PlaybackBeat> = {}): PlaybackBeat {
  return { id: "qa-preview", kind, actorPlayerId: "p0", durationMs: 5000, resultVersion: 1, lastEventSequence: 0, ...extra };
}

function buildScenario(kind: string): Scenario {
  switch (kind) {
    case "ROTATE":
      return {
        beat: beatBase("ROTATE", { chosenColor: "VIOLET", durationMs: 3200 }),
        discard: { color: "WILD", type: "ROTATE_HANDS" },
        activeColor: "VIOLET",
        currentPlayerIndex: 0,
      };
    case "SWAP":
      return {
        beat: beatBase("SWAP", { actorPlayerId: "p0", targetPlayerId: "p3", chosenColor: "BLUE", durationMs: 3600 }),
        discard: { color: "WILD", type: "SWAP_HAND" },
        activeColor: "BLUE",
        currentPlayerIndex: 0,
      };
    case "TARGET":
      return {
        beat: beatBase("SKIP", { actorPlayerId: "p0", targetPlayerId: "p2", durationMs: 900 }),
        discard: { color: "RED", type: "TARGET_SKIP" },
        activeColor: "RED",
        currentPlayerIndex: 0,
        pendingSkipTargets: { p2: 1 },
      };
    case "DRAW_2":
      return {
        beat: beatBase("DRAW", { actorPlayerId: "p1", count: 2, totalAmount: 2, durationMs: 900 }),
        discard: { color: "BLUE", type: "DRAW_2" },
        activeColor: "BLUE",
        currentPlayerIndex: 1,
      };
    case "DRAW_4":
      return {
        beat: beatBase("DRAW", { actorPlayerId: "p3", count: 4, totalAmount: 4, durationMs: 1400 }),
        discard: { color: "YELLOW", type: "DRAW_4" },
        activeColor: "YELLOW",
        currentPlayerIndex: 3,
      };
    case "LOWEST":
      return {
        beat: beatBase("DRAW", { actorPlayerId: "p4", count: 2, totalAmount: 2, durationMs: 900 }),
        discard: { color: "GREEN", type: "GIVE_TWO_TO_LOWEST" },
        activeColor: "GREEN",
        currentPlayerIndex: 0,
      };
    case "DITCH":
      return {
        beat: beatBase("EXTRA", { actorPlayerId: "p0", card: { color: "RED", type: "TRIANGLE" }, durationMs: 800 }),
        discard: { color: "RED", type: "TRIANGLE" },
        activeColor: "RED",
        currentPlayerIndex: 0,
      };
    case "SKIP":
      return {
        beat: beatBase("SKIP", { actorPlayerId: "p2", targetPlayerId: "p3", durationMs: 750 }),
        discard: { color: "GREEN", type: "SKIP" },
        activeColor: "GREEN",
        currentPlayerIndex: 2,
        pendingSkipTargets: { p3: 1 },
      };
    case "REVERSE":
      return {
        beat: beatBase("PLAY", { actorPlayerId: "p0", card: { color: "VIOLET", type: "REVERSE" }, durationMs: 750 }),
        discard: { color: "VIOLET", type: "REVERSE" },
        activeColor: "VIOLET",
        currentPlayerIndex: 0,
        direction: 1,
        flipDirectionAfterMs: 300,
      };
    case "SKIP_ALL":
      return {
        beat: beatBase("PLAY", { actorPlayerId: "p0", card: { color: "WILD", type: "SKIP_EVERYONE" }, chosenColor: "RED", durationMs: 3400 }),
        discard: { color: "WILD", type: "SKIP_EVERYONE" },
        activeColor: "RED",
        currentPlayerIndex: 0,
      };
    case "WILD_DRAW_10":
      return {
        beat: beatBase("PLAY", { actorPlayerId: "p1", card: { color: "WILD", type: "WILD_DRAW_10" }, chosenColor: "GREEN", durationMs: 3400 }),
        discard: { color: "WILD", type: "WILD_DRAW_10" },
        activeColor: "GREEN",
        currentPlayerIndex: 1,
      };
    case "COLOR_ROULETTE":
      return {
        beat: beatBase("PLAY", { actorPlayerId: "p2", card: { color: "WILD", type: "WILD_COLOR_ROULETTE" }, chosenColor: "YELLOW", durationMs: 3400 }),
        discard: { color: "WILD", type: "WILD_COLOR_ROULETTE" },
        activeColor: "YELLOW",
        currentPlayerIndex: 2,
      };
    case "WILD_REVERSE_DRAW_4":
      return {
        beat: beatBase("PLAY", { actorPlayerId: "p3", card: { color: "WILD", type: "WILD_REVERSE_DRAW_4" }, chosenColor: "BLUE", durationMs: 3400 }),
        discard: { color: "WILD", type: "WILD_REVERSE_DRAW_4" },
        activeColor: "BLUE",
        currentPlayerIndex: 3,
      };
    default:
      return { beat: null, discard: { color: "RED", type: "TRIANGLE" }, activeColor: "RED", currentPlayerIndex: 0 };
  }
}

export function ActionPreview() {
  const [params] = useSearchParams();
  const kind = (params.get("kind") ?? "ROTATE").toUpperCase();
  const playerCount = Math.min(8, Math.max(2, Number(params.get("players") ?? 6)));
  const scenario = useMemo(() => buildScenario(kind), [kind]);
  const [direction, setDirection] = useState<Direction>(scenario.direction ?? 1);

  useEffect(() => {
    setDirection(scenario.direction ?? 1);
    if (scenario.flipDirectionAfterMs) {
      const t = setTimeout(() => setDirection((d) => (d === 1 ? -1 : 1)), scenario.flipDirectionAfterMs);
      return () => clearTimeout(t);
    }
  }, [scenario]);

  const players = useMemo(() => makePlayers(playerCount), [playerCount]);

  const publicState: PublicGameState = {
    roomId: "qa-room",
    gameId: "qa-game",
    version: 1,
    status: "PLAYING",
    direction,
    phase: "WAITING_FOR_PLAY",
    currentPlayerId: players[scenario.currentPlayerIndex % players.length]?.playerId ?? "p0",
    players,
    topDiscard: { defId: "qa-discard", color: scenario.discard.color, type: scenario.discard.type },
    activeColor: scenario.activeColor,
    pendingEffect: scenario.pendingEffect ?? null,
    pendingSkipTargets: scenario.pendingSkipTargets ?? {},
    drawPileCount: 96,
    winnerPlayerId: null,
  };

  const playback = scenario.beat
    ? { beat: scenario.beat, position: 1, total: 1, canSkip: false, onSkip: () => {}, active: true }
    : null;

  return (
    // Matches the real TableGame.tsx page exactly (no explicit background of
    // its own, just the themed `body`) - was a hardcoded #000 before Dark
    // Mode existed, which silently hid whether TABLE_DEVICE's real page
    // background was actually reacting to the active theme.
    <div style={{ height: "100dvh" }}>
      <GameTable publicState={publicState} mode="TABLE_DEVICE" playback={playback} />
    </div>
  );
}
