import { useEffect, useRef, useState } from "react";
import type { Direction } from "../../game/types";
import "./OrbitFlow.css";

export interface TurnArc {
  /** Degrees, matching seatGeometry's seatAngleDeg for the current and next seat. */
  fromAngleDeg: number;
  toAngleDeg: number;
}

export interface OrbitFlowProps {
  direction: Direction;
  /** Compact mode draws a shorter arc instead of a full oval, for the mobile ring. */
  compact?: boolean;
  /**
   * REMOTE_MOBILE_FULL only: highlights the current->next segment instead of
   * the generic 4-marker chase (TABLE_DEVICE never passes this — its own
   * orbit treatment is unchanged, see MOBILE_HAND_UI_FIX_REPORT.md follow-up).
   * `null` (vs. omitted) means "an action choreography is temporarily taking
   * over" — the bright segment is hidden but the ambient dim pulse remains,
   * so the two motions never compete.
   */
  turnArc?: TurnArc | null;
}

const MARKER_ANGLES_DEG = [-90, 0, 90, 180];

function pointOnEllipse(angleDeg: number, rx: number, ry: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: 50 + rx * Math.cos(rad), y: 50 + ry * Math.sin(rad) };
}

/** Replaces the old isolated "Clockwise" direction widget: a dim flow path woven directly into the table/ring, per TABLE_UI_IMPLEMENTATION_REPORT.md section 6. */
export function OrbitFlow({ direction, compact = false, turnArc }: OrbitFlowProps) {
  const [reversing, setReversing] = useState(false);
  const lastDirection = useRef(direction);
  // SMIL's <animateMotion> can't be paused via CSS the way the other chase
  // effects here are (their @media(prefers-reduced-motion) rules just
  // disable a CSS animation) — checked directly so the traveling turn-arc
  // pulse is skipped entirely under reduced motion, leaving only the static
  // glowing arc (still fully conveys direction without motion).
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (lastDirection.current === direction) return;
    lastDirection.current = direction;
    setReversing(true);
    const timeout = setTimeout(() => setReversing(false), 950);
    return () => clearTimeout(timeout);
  }, [direction]);

  // Full (table device) radii track PlayerRing's tighter seat ellipse
  // (35/30, see PlayerRing.tsx) so the flow sits just outside the seats
  // instead of drifting out toward the old, wider ring. Compact now tracks
  // PlayerRing's own COMPACT_RING_RADII exactly, since seats sit on this
  // same ellipse (MOBILE_HAND_UI_FIX_REPORT.md follow-up), not the old
  // wide/flat 47x20 arc used behind the previous flex-strip ring.
  const rx = compact ? 35 : 36;
  const ry = compact ? 37 : 35;
  const clockwise = direction === 1;
  // Sequential order around the ellipse so the 4 markers "chase" in the
  // current direction — reversed order simply plays the same chase backwards.
  const orderedAngles = clockwise ? MARKER_ANGLES_DEG : [...MARKER_ANGLES_DEG].reverse();
  const isMobileTurnArcMode = compact && turnArc !== undefined;

  const arc = turnArc
    ? (() => {
        const from = pointOnEllipse(turnArc.fromAngleDeg, rx, ry);
        const to = pointOnEllipse(turnArc.toAngleDeg, rx, ry);
        // Always exactly one step between adjacent seats, so the swept angle
        // is always <180deg (or exactly 180 for 2 players) - never the major arc.
        const sweepFlag = direction === 1 ? 1 : 0;
        return { d: `M ${from.x} ${from.y} A ${rx} ${ry} 0 0 ${sweepFlag} ${to.x} ${to.y}` };
      })()
    : null;

  return (
    <svg
      className={`orbit-flow ${direction === -1 ? "orbit-flow--ccw" : ""} ${reversing ? "orbit-flow--reversing" : ""} ${isMobileTurnArcMode ? "orbit-flow--turn-arc-mode" : ""}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <ellipse className="orbit-flow__track" cx="50" cy="50" rx={rx} ry={ry} />
      {/* In turn-arc mode the generic full-loop pulse stays only as a very
          dim ambient base (see .orbit-flow--turn-arc-mode in OrbitFlow.css) —
          the bright arc below is what actually carries the direction/next-up
          information now. */}
      <ellipse className="orbit-flow__pulse" cx="50" cy="50" rx={rx} ry={ry} />
      <ellipse className="orbit-flow__pulse orbit-flow__pulse--b" cx="50" cy="50" rx={rx} ry={ry} />
      {!compact &&
        orderedAngles.map((angle, index) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <ellipse
              key={angle}
              className="orbit-flow__marker"
              style={{ animationDelay: `${index * -0.5}s` }}
              cx={50 + rx * Math.cos(rad)}
              cy={50 + ry * Math.sin(rad)}
              rx="1.1"
              ry="1.1"
            />
          );
        })}
      {arc && (
        <>
          <path className="orbit-flow__turn-arc" d={arc.d} />
          {/* Keyed by the arc's own endpoints so a turn/reverse change remounts
              this element instead of relying on SMIL to notice an attribute
              change mid-loop (unreliable across browsers). */}
          {!reducedMotion && (
            <circle key={arc.d} className="orbit-flow__turn-pulse" r="1.6">
              <animateMotion dur="1.6s" repeatCount="indefinite" path={arc.d} rotate="auto" />
            </circle>
          )}
        </>
      )}
    </svg>
  );
}
