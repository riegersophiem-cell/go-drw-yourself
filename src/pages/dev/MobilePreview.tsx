// DEV-ONLY deterministic mobile QA harness — mirrors ActionPreview.tsx's
// approach (see App.tsx: import.meta.env.DEV-gated lazy route, fully
// dead-code-eliminated from a production build) but for REMOTE_MOBILE_FULL
// and the private hand instead of TABLE_DEVICE. Renders the exact same
// PlayerGame.css classes/markup structure the real mobile page uses, against
// a hand-built PublicGameState + a synthetic hand of N cards, so any hand
// size (5/10/11/13/20/21/22/30) or mobile action (ROTATE/SWAP/TARGET/DRAW_4)
// can be reproduced instantly for screenshotting instead of grinding out a
// real multi-device Supabase session. See MOBILE_HAND_UI_FIX_REPORT.md.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GameTable } from "../../components/GameTable/GameTable";
import { HandDock } from "../../components/GameTable/HandDock";
import { PlayerHand, type HandCard } from "../../components/PlayerHand/PlayerHand";
import { PLAIN_SYMBOL_TYPES, CORE_ACTION_TYPES } from "../../game/types";
import type { CardColor, CardType, Direction, PublicGameState, PublicPlayerView } from "../../game/types";
import type { PlaybackBeat } from "../../multiplayer/playbackBeats";
import "../PlayerGame.css";

const NAMES = ["Sophie", "Bot 2", "Bot 3", "Bot 4", "Bot 5", "Bot 6", "Bot 7", "Bot 8"];
const AVATARS = ["H01", "BOT1", "BOT2", "BOT3", "BOT4", "BOT5"] as const;
const COLORS: Exclude<CardColor, "WILD">[] = ["RED", "BLUE", "GREEN", "YELLOW", "VIOLET"];
const HAND_TYPES: CardType[] = [...PLAIN_SYMBOL_TYPES, ...CORE_ACTION_TYPES];

function makePlayers(count: number): PublicPlayerView[] {
  return Array.from({ length: count }, (_, i) => ({
    playerId: `p${i}`,
    displayName: NAMES[i] ?? `Bot ${i + 1}`,
    type: i === 0 ? "HUMAN" : "BOT",
    avatar: AVATARS[i % AVATARS.length],
    seatIndex: i,
    cardCount: i === 0 ? 7 : 6 + i,
    connected: true,
    eliminated: false,
  }));
}

function makeHand(count: number): HandCard[] {
  return Array.from({ length: count }, (_, i) => {
    const color = COLORS[i % COLORS.length];
    const type = HAND_TYPES[Math.floor(i / COLORS.length) % HAND_TYPES.length];
    return { instanceId: `qa-hand-${i}`, def: { defId: `qa-hand-def-${i}`, color, type } };
  });
}

interface ActionScenario {
  beat: PlaybackBeat | null;
  discard: { color: CardColor; type: CardType };
  activeColor: CardColor;
  currentPlayerIndex: number;
  pendingSkipTargets?: Record<string, number>;
}

function buildAction(kind: string): ActionScenario {
  switch (kind) {
    case "ROTATE":
      return { beat: { id: "qa-mobile", kind: "ROTATE", actorPlayerId: "p0", chosenColor: "VIOLET", durationMs: 3200, resultVersion: 1, lastEventSequence: 0 }, discard: { color: "WILD", type: "ROTATE_HANDS" }, activeColor: "VIOLET", currentPlayerIndex: 0 };
    case "SWAP":
      return { beat: { id: "qa-mobile", kind: "SWAP", actorPlayerId: "p0", targetPlayerId: "p3", chosenColor: "BLUE", durationMs: 3600, resultVersion: 1, lastEventSequence: 0 }, discard: { color: "WILD", type: "SWAP_HAND" }, activeColor: "BLUE", currentPlayerIndex: 0 };
    case "TARGET":
      return { beat: { id: "qa-mobile", kind: "SKIP", actorPlayerId: "p0", targetPlayerId: "p2", durationMs: 900, resultVersion: 1, lastEventSequence: 0 }, discard: { color: "RED", type: "TARGET_SKIP" }, activeColor: "RED", currentPlayerIndex: 0, pendingSkipTargets: { p2: 1 } };
    case "DRAW_4":
      return { beat: { id: "qa-mobile", kind: "DRAW", actorPlayerId: "p0", count: 4, totalAmount: 4, durationMs: 1400, resultVersion: 1, lastEventSequence: 0 }, discard: { color: "YELLOW", type: "DRAW_4" }, activeColor: "YELLOW", currentPlayerIndex: 3 };
    default:
      return { beat: null, discard: { color: "RED", type: "TRIANGLE" }, activeColor: "RED", currentPlayerIndex: 0 };
  }
}

export function MobilePreview() {
  const [params] = useSearchParams();
  const handCount = Math.min(30, Math.max(0, Number(params.get("hand") ?? 7)));
  const kind = (params.get("kind") ?? "").toUpperCase();
  const playerCount = Math.min(8, Math.max(2, Number(params.get("players") ?? 5)));
  const direction: Direction = params.get("direction") === "-1" ? -1 : 1;
  // PLAYER_HAND_ONLY is a PlayerGame-level view toggle gated by a live
  // Supabase "is there a TABLE_DEVICE in this room" check (useHasTableDevice)
  // — no real backend in this dev harness, so it's driven by a query param
  // instead, mirroring PlayerGame.tsx's own `effectiveHandOnly` markup
  // exactly (see MOBILE_HAND_UI_FIX_REPORT.md section 18).
  const handOnly = params.get("handOnly") === "1";
  const isMyTurn = params.get("myTurn") !== "0";
  const pendingDraw = Number(params.get("pending") ?? 0);
  const [selected, setSelected] = useState<string | null>(null);

  const players = useMemo(() => makePlayers(playerCount), [playerCount]);
  const hand = useMemo(() => makeHand(handCount), [handCount]);
  const action = useMemo(() => buildAction(kind), [kind]);

  const publicState: PublicGameState = {
    roomId: "qa-room",
    gameId: "qa-game",
    version: 1,
    status: "PLAYING",
    direction,
    phase: "WAITING_FOR_PLAY",
    currentPlayerId: isMyTurn ? "p0" : (players[action.beat ? action.currentPlayerIndex % players.length : 1]?.playerId ?? "p1"),
    players,
    topDiscard: { defId: "qa-discard", color: action.discard.color, type: action.discard.type },
    activeColor: action.activeColor,
    pendingEffect: pendingDraw > 0 ? { type: "DRAW_STACK", amount: pendingDraw, lastDrawValue: pendingDraw, terminal: false, sourcePlayerId: "p1" } : null,
    pendingSkipTargets: action.pendingSkipTargets ?? {},
    drawPileCount: 74,
    winnerPlayerId: null,
  };

  const playback = action.beat ? { beat: action.beat, position: 1, total: 1, canSkip: false, onSkip: () => {}, active: true } : null;

  return (
    <main className={`player-game ${handOnly ? "player-game--hand-only" : ""}`}>
      <header className="player-game__topbar">
        <div className="player-game__brand"><strong>GO DR*W<br />YOURSELF</strong><span>Swap it. Stack it. Make it someone else&apos;s problem.</span></div>
        <div className="player-game__room"><span>Raum</span><strong>QA-01</strong></div>
        <div className="player-game__top-actions">
          {!handOnly && <div className="player-game__meta"><span aria-hidden="true">♙</span><strong>{playerCount} / 8</strong></div>}
          <button type="button">Aufgeben</button>
        </div>
      </header>

      <div className="player-game__board">
        <GameTable publicState={publicState} mode="REMOTE_MOBILE_FULL" ownPlayerId="p0" playback={playback} />
      </div>

      <HandDock className="player-game__dock" aria-label="Deine Karten und Aktionen">
        {handOnly && <div className="player-game__hand-only-status" role="status">
          <strong>{isMyTurn ? "Du bist dran" : `${players.find((p) => p.playerId === publicState.currentPlayerId)?.displayName ?? "Nächster Spieler"} ist dran`}</strong>
          <span>{pendingDraw > 0 ? `Aktiver Ziehstapel: +${pendingDraw}` : `${hand.length} Karten auf deiner Hand`}</span>
        </div>}
        <div className="player-game__hand-wrap">
          <button className="player-game__sort" type="button"><span aria-hidden="true">⇅</span> Sortieren</button>
          <PlayerHand cards={hand} legalInstanceIds={hand.map((c) => c.instanceId)} selectedInstanceId={selected} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} />
        </div>
        <div className="player-game__actions">
          <button className={`player-game__play ${selected ? "player-game__play--ready" : ""}`} disabled={!isMyTurn || !selected}><span aria-hidden="true">▶</span>Karte spielen</button>
          <button className="player-game__draw" disabled={!isMyTurn}><span aria-hidden="true">▣</span>Karte ziehen</button>
        </div>
      </HandDock>
    </main>
  );
}
