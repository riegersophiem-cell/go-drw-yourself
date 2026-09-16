import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PublicGameState, PublicPlayerView } from "../../game/types";
import { resolveSeatOrder, swapSeats } from "../../game/seatLayout";
import { PlayerRing, type RingHighlight } from "./PlayerRing";
import { computeFullRingSeatPoints, COMPACT_RING_RADII, seatAngleDeg } from "../../game/seatGeometry";
import { DiscardStage } from "./DiscardStage";
import { OrbitFlow, type TurnArc } from "./OrbitFlow";
import { ActionFocus, type ActionFocusProps } from "./ActionFocus";
import { ActionChoreography } from "./ActionChoreography";
import { MobileActionMotion } from "./MobileActionMotion";
import { classifyBeatSeverity } from "../../game/actionSeverity";
import "./GameTable.css";

export type GameTableMode = "TABLE_DEVICE" | "REMOTE_MOBILE_FULL";

export interface GameTableProps {
  publicState: PublicGameState;
  mode: GameTableMode;
  ownPlayerId?: string;
  /** Stored visual seat order (player ids); null/missing falls back to natural order. */
  seatOrder?: string[] | null;
  /** Only meaningful on TABLE_DEVICE — lets the table's own operator drag/tap-reseat players. */
  canEditSeats?: boolean;
  onPersistSeatOrder?: (newOrder: string[]) => void;
  playback?: Omit<ActionFocusProps, "players"> & { active: boolean } | null;
  canRemovePlayers?: boolean;
  removingPlayerId?: string | null;
  onRemovePlayer?: (playerId: string) => void;
  /** REMOTE_MOBILE_FULL only: the private hand + its controls, framed by HandDock at the call site. */
  handSlot?: ReactNode;
}

function ringHighlightFromPlayback(playback: GameTableProps["playback"]): RingHighlight | null {
  if (!playback?.active) return null;
  const { beat } = playback;
  const kind =
    beat.kind === "SWAP" || beat.kind === "ROTATE" || beat.kind === "SKIP"
      ? beat.kind
      : beat.card?.type === "SKIP_EVERYONE"
        ? "SKIP_ALL"
        : null;
  return { actorPlayerId: beat.actorPlayerId, targetPlayerId: beat.targetPlayerId ?? null, kind };
}

/**
 * Shared table composition used by both TABLE_DEVICE and REMOTE_MOBILE_FULL —
 * see TABLE_UI_IMPLEMENTATION_REPORT.md section 1. The two modes compose the
 * same PlayerRing / DiscardStage / OrbitFlow / ActionFocus pieces into
 * different layouts (full oval + no hand vs. compact strip + hero stage +
 * hand dock); neither mode has its own copy of this logic.
 */
export function GameTable({
  publicState,
  mode,
  ownPlayerId,
  seatOrder,
  canEditSeats = false,
  onPersistSeatOrder,
  playback,
  canRemovePlayers = false,
  removingPlayerId,
  onRemovePlayer,
  handSlot,
}: GameTableProps) {
  const [seatEditMode, setSeatEditMode] = useState(false);
  const [seatEditSelectedId, setSeatEditSelectedId] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const seatedPlayers = useMemo(() => publicState.players.filter((p) => !p.eliminated), [publicState.players]);
  const orderedPlayers = useMemo(() => resolveSeatOrder(seatedPlayers, seatOrder ?? null), [seatedPlayers, seatOrder]);
  const highlight = ringHighlightFromPlayback(playback);
  // Same points PlayerRing renders its units at (see FULL_RING_RADII) — the
  // choreography layer travels card-stack symbols between these exact
  // coordinates so motion always lines up with the actual avatars.
  const seatPoints = useMemo(() => computeFullRingSeatPoints(orderedPlayers.length), [orderedPlayers.length]);

  // Current -> next turn arc (REMOTE_MOBILE_FULL only, see OrbitFlow.tsx):
  // pre-computed here since it needs both the resolved seat order and the
  // authoritative direction/currentPlayerId, same inputs PlayerRing/OrbitFlow
  // already receive separately.
  const n = orderedPlayers.length;
  const currentSeatIndex = orderedPlayers.findIndex((p) => p.playerId === publicState.currentPlayerId);
  const nextSeatIndex = n > 1 && currentSeatIndex !== -1 ? (((currentSeatIndex + publicState.direction) % n) + n) % n : -1;
  const nextPlayerId = nextSeatIndex !== -1 ? orderedPlayers[nextSeatIndex].playerId : null;
  const turnArc: TurnArc | null =
    n > 1 && currentSeatIndex !== -1
      ? { fromAngleDeg: seatAngleDeg(currentSeatIndex, n, COMPACT_RING_RADII), toAngleDeg: seatAngleDeg(nextSeatIndex, n, COMPACT_RING_RADII) }
      : null;

  function handleSeatTap(playerId: string) {
    if (!seatEditSelectedId) {
      setSeatEditSelectedId(playerId);
      return;
    }
    if (seatEditSelectedId === playerId) {
      setSeatEditSelectedId(null);
      return;
    }
    const newOrder = swapSeats(orderedPlayers as PublicPlayerView[], seatEditSelectedId, playerId);
    setSeatEditSelectedId(null);
    onPersistSeatOrder?.(newOrder);
  }

  const isTable = mode === "TABLE_DEVICE";
  // Presentation-only classification (see actionSeverity.ts) reused here just
  // to let REMOTE_MOBILE_FULL's CSS temporarily grow the public table / recede
  // the hand dock for a Major Action (brief section 22) — never used to
  // decide game behavior.
  const severityClass = playback?.active ? `game-table--focus-severity-${classifyBeatSeverity(playback.beat).toLowerCase()}` : "";

  return (
    <section className={`game-table game-table--${mode.toLowerCase()} ${playback?.active ? `game-table--focus game-table--focus-${playback.beat.kind.toLowerCase()} ${severityClass}` : ""}`} aria-label="Spieltisch">
      {isTable && canEditSeats && (
        <button
          type="button"
          className={`game-table__seat-edit-toggle ${seatEditMode ? "game-table__seat-edit-toggle--active" : ""}`}
          onClick={() => { setSeatEditMode((v) => !v); setSeatEditSelectedId(null); }}
          aria-label={seatEditMode ? "Sitzordnung fertig" : "Sitzordnung anpassen"}
          title={seatEditMode ? "Sitzordnung fertig" : "Sitzordnung anpassen"}
        >
          <span aria-hidden="true">{seatEditMode ? "✓" : "⤢"}</span>
          {seatEditMode && <span>Fertig</span>}
        </button>
      )}
      <div className="game-table__surface" ref={surfaceRef}>
        <OrbitFlow
          direction={publicState.direction}
          compact={!isTable}
          turnArc={isTable ? undefined : playback?.active ? null : turnArc}
        />
        <PlayerRing
          players={orderedPlayers}
          currentPlayerId={publicState.currentPlayerId}
          ownPlayerId={ownPlayerId}
          pendingSkipTargets={publicState.pendingSkipTargets}
          pendingEffect={publicState.pendingEffect}
          variant={isTable ? "full" : "compact"}
          nextPlayerId={nextPlayerId}
          highlight={highlight}
          seatEditMode={isTable && seatEditMode}
          seatEditSelectedId={seatEditSelectedId}
          onSeatTap={handleSeatTap}
          canRemovePlayers={canRemovePlayers}
          removingPlayerId={removingPlayerId}
          onRemovePlayer={onRemovePlayer}
        />
        <DiscardStage
          topDiscard={publicState.topDiscard}
          drawPileCount={publicState.drawPileCount}
          pendingEffect={publicState.pendingEffect}
          activeColor={publicState.activeColor}
          phase={publicState.phase}
          compact={!isTable}
        />
        {isTable && playback?.active && (
          <ActionChoreography key={playback.beat.id} beat={playback.beat} players={orderedPlayers} seatPoints={seatPoints} direction={publicState.direction} />
        )}
        {!isTable && playback?.active && (
          <MobileActionMotion key={playback.beat.id} beat={playback.beat} players={orderedPlayers} direction={publicState.direction} containerRef={surfaceRef} />
        )}
      </div>
      {playback && <ActionFocus key={`${playback.beat.id}:${playback.active}`} {...playback} players={publicState.players} tableDevice={isTable} />}
      {!isTable && handSlot}
    </section>
  );
}
