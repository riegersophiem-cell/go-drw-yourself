import { useEffect, useState } from "react";
import type { CardColor, Direction, PublicPlayerView } from "../../game/types";
import type { PlaybackBeat } from "../../multiplayer/playbackBeats";
import type { SeatPoint } from "../../game/seatGeometry";
import "./ActionChoreography.css";

export interface ActionChoreographyProps {
  beat: PlaybackBeat;
  players: PublicPlayerView[]; // same ring order PlayerRing renders, one seatPoint per entry
  seatPoints: SeatPoint[];
  direction: Direction;
}

const COLOR_HEX: Record<Exclude<CardColor, "WILD">, string> = {
  RED: "#e5484d", BLUE: "#3b82f6", GREEN: "#22c55e", YELLOW: "#eab308", VIOLET: "#7047eb",
};

/** The draw pile's fixed position within `.game-table__surface` (measured live — see ACTION_FOCUS_POLISH_REPORT.md) — card-backs fly from here, not from the dead center (which is the discard pile). */
const DRAW_PILE_POINT: SeatPoint = { leftPct: 40.8, topPct: 51.2 };

function indexOfPlayer(players: PublicPlayerView[], id: string | null | undefined): number {
  return players.findIndex((p) => p.playerId === id);
}

/** A point offset from the a→b midpoint, pushed away from the table center — approximates following the ring's own curvature instead of cutting a straight chord across it. */
function bowOutward(a: SeatPoint, b: SeatPoint, amount: number): SeatPoint {
  const mx = (a.leftPct + b.leftPct) / 2;
  const my = (a.topPct + b.topPct) / 2;
  const dx = mx - 50;
  const dy = my - 50;
  const len = Math.hypot(dx, dy) || 1;
  return { leftPct: mx + (dx / len) * amount, topPct: my + (dy / len) * amount };
}

/** A point offset perpendicular to the a→b line — used for SWAP so the two opposite-direction stacks trace visually distinct arcs instead of overlapping on the same line. */
function bowPerpendicular(a: SeatPoint, b: SeatPoint, amount: number): SeatPoint {
  const mx = (a.leftPct + b.leftPct) / 2;
  const my = (a.topPct + b.topPct) / 2;
  const dx = b.leftPct - a.leftPct;
  const dy = b.topPct - a.topPct;
  const len = Math.hypot(dx, dy) || 1;
  return { leftPct: mx + (-dy / len) * amount, topPct: my + (dx / len) * amount };
}

/** Quadratic-bezier-ish position at t∈[0,1] through a single bowed control point — cheap curved motion without full SVG offset-path plumbing. */
function curvedPoint(a: SeatPoint, ctrl: SeatPoint, b: SeatPoint, t: number): SeatPoint {
  const u = 1 - t;
  return {
    leftPct: u * u * a.leftPct + 2 * u * t * ctrl.leftPct + t * t * b.leftPct,
    topPct: u * u * a.topPct + 2 * u * t * ctrl.topPct + t * t * b.topPct,
  };
}

/** A small, clearly-a-hand-of-cards glyph — 3 layered card-backs, see .action-choreo__handstack. Never shows another player's real cards. */
function HandStackGlyph({ point, delayMs }: { point: SeatPoint; delayMs?: number }) {
  return (
    <div className="action-choreo__handstack" style={{ left: `${point.leftPct}%`, top: `${point.topPct}%`, transitionDelay: delayMs ? `${delayMs}ms` : undefined }}>
      <span className="action-choreo__handstack-leaf" />
      <span className="action-choreo__handstack-leaf" />
      <span className="action-choreo__handstack-leaf" />
    </div>
  );
}

function CardBackGlyph({ point, delayMs }: { point: SeatPoint; delayMs?: number }) {
  return <div className="action-choreo__cardback" style={{ left: `${point.leftPct}%`, top: `${point.topPct}%`, transitionDelay: delayMs ? `${delayMs}ms` : undefined }} />;
}

/**
 * Never-private card-back symbols that travel between the exact seat points
 * PlayerRing renders its units at — this is what actually explains a Major
 * Action (whose hand goes where, who swaps with whom) instead of leaving it
 * to a text headline alone (ACTION_FOCUS_FIX_REPORT.md /
 * ACTION_FOCUS_POLISH_REPORT.md). Purely presentational: it reads an
 * already-resolved PlaybackBeat, it never decides anything, and it never
 * renders another player's real cards — only anonymous card-back glyphs and
 * counts.
 *
 * Z-INDEX within `.game-table__surface` (documented once, here, since every
 * layer in this stack is a sibling): OrbitFlow(1) < PlayerRing(4) <
 * DiscardStage(5) < ActionChoreography links(6)/glyphs(7) < ActionFocus(18).
 */
export function ActionChoreography({ beat, players, seatPoints, direction }: ActionChoreographyProps) {
  // 0 = at the start point, 1 = at the bowed midpoint, 2 = arrived.
  const [step, setStep] = useState(0);
  const accent = beat.chosenColor ? COLOR_HEX[beat.chosenColor] : beat.card && beat.card.color !== "WILD" ? COLOR_HEX[beat.card.color] : "#93b4ff";

  useEffect(() => {
    setStep(0);
    const t1 = setTimeout(() => setStep(1), 60);
    const t2 = setTimeout(() => setStep(2), 420);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [beat.id]);

  if (!players.length || seatPoints.length !== players.length) return null;

  if (beat.kind === "ROTATE") {
    const n = players.length;
    return (
      <div className="action-choreo" aria-hidden="true">
        {players.map((_, i) => {
          const from = seatPoints[i];
          const to = seatPoints[(((i + direction) % n) + n) % n];
          const ctrl = bowOutward(from, to, 5.5);
          const t = step === 0 ? 0 : step === 1 ? 0.55 : 1;
          const pos = curvedPoint(from, ctrl, to, t);
          return <HandStackGlyph key={i} point={pos} delayMs={i * 35} />;
        })}
      </div>
    );
  }

  if (beat.kind === "SWAP") {
    const actorIdx = indexOfPlayer(players, beat.actorPlayerId);
    const targetIdx = indexOfPlayer(players, beat.targetPlayerId);
    if (actorIdx === -1 || targetIdx === -1) return null;
    const a = seatPoints[actorIdx];
    const b = seatPoints[targetIdx];
    const ctrlAB = bowPerpendicular(a, b, 7);
    const ctrlBA = bowPerpendicular(b, a, 7);
    const t = step === 0 ? 0 : step === 1 ? 0.55 : 1;
    const posAB = curvedPoint(a, ctrlAB, b, t); // actor's stack travelling to target
    const posBA = curvedPoint(b, ctrlBA, a, t); // target's stack travelling to actor
    return (
      <div className="action-choreo" aria-hidden="true">
        <svg className="action-choreo__link" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path className="action-choreo__swap-path" d={`M ${a.leftPct} ${a.topPct} Q ${ctrlAB.leftPct} ${ctrlAB.topPct} ${b.leftPct} ${b.topPct}`} style={{ stroke: accent }} />
          <path className="action-choreo__swap-path" d={`M ${b.leftPct} ${b.topPct} Q ${ctrlBA.leftPct} ${ctrlBA.topPct} ${a.leftPct} ${a.topPct}`} style={{ stroke: accent }} />
        </svg>
        <HandStackGlyph point={posAB} />
        <HandStackGlyph point={posBA} delayMs={60} />
      </div>
    );
  }

  if (beat.kind === "SKIP" && beat.targetPlayerId) {
    const actorIdx = indexOfPlayer(players, beat.actorPlayerId);
    const targetIdx = indexOfPlayer(players, beat.targetPlayerId);
    if (actorIdx === -1 || targetIdx === -1) return null;
    const a = seatPoints[actorIdx];
    const b = seatPoints[targetIdx];
    return (
      <div className="action-choreo" aria-hidden="true">
        <svg className="action-choreo__link" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line className="action-choreo__target-line" x1={a.leftPct} y1={a.topPct} x2={b.leftPct} y2={b.topPct} style={{ stroke: accent, color: accent }} />
        </svg>
        <div className="action-choreo__marker" style={{ left: `${b.leftPct}%`, top: `${b.topPct}%`, borderColor: accent, boxShadow: `0 0 10px ${accent}` }} />
      </div>
    );
  }

  if ((beat.kind === "DRAW" || beat.kind === "STACK") && beat.actorPlayerId) {
    const idx = indexOfPlayer(players, beat.actorPlayerId);
    if (idx === -1) return null;
    const to = seatPoints[idx];
    const count = Math.min(4, beat.count ?? 1);
    const ctrl = bowOutward(DRAW_PILE_POINT, to, 4);
    const t = step === 0 ? 0 : step === 1 ? 0.5 : 1;
    return (
      <div className="action-choreo" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => {
          const localT = Math.max(0, Math.min(1, t - i * 0.08));
          const pos = curvedPoint(DRAW_PILE_POINT, ctrl, to, localT);
          return <CardBackGlyph key={i} point={pos} delayMs={i * 80} />;
        })}
      </div>
    );
  }

  return null;
}
