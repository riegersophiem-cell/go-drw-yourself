// Pure math for placing seats on an oval "table" — used by PlayerRing on both
// TABLE_DEVICE (full oval) and REMOTE_MOBILE_FULL (compressed half-ellipse).
// Deliberately has zero React/DOM dependency so it's trivially unit-testable
// and reusable between the two layouts.
//
// Seat COUNT and INDEX here refer to *visual slot* position, not player
// identity or turn order — see SeatAssignment in seatLayout.ts for how a
// player is mapped onto a slot.

export interface SeatPoint {
  /** 0-100, percentage of the oval's bounding box. */
  leftPct: number;
  topPct: number;
}

export interface EllipseOptions {
  /** Horizontal radius as a % of the bounding box (0-50). Default 43. */
  radiusXPct?: number;
  /** Vertical radius as a % of the bounding box (0-50). Default 37. */
  radiusYPct?: number;
  /** Degrees, where 0 = 3 o'clock, -90 = 12 o'clock (top-center, the default first-seat position). */
  startAngleDeg?: number;
  /** Restrict seats to a partial arc (e.g. 200 for a half-ellipse on mobile) instead of the full 360. */
  arcDeg?: number;
}

/**
 * Evenly distributes `count` seats around an ellipse. Seat 0 sits at
 * `startAngleDeg` (top-center by default, matching a real table's "head"
 * seat), and the rest proceed clockwise. This single formula replaces the
 * old per-count hardcoded layouts (2/3/4/N special cases) — every seat
 * count, including reordered ones, comes from the same continuous curve.
 */
/** Seat ellipse used by the full (TABLE_DEVICE) ring — shared by PlayerRing and ActionChoreography so motion always travels between the exact points the units render at. */
export const FULL_RING_RADII: EllipseOptions = { radiusXPct: 34, radiusYPct: 33 };
export function computeFullRingSeatPoints(count: number): SeatPoint[] {
  return computeSeatPoints(count, FULL_RING_RADII);
}

/** Compact (REMOTE_MOBILE_FULL) seat ellipse — a real ellipse like the table's,
 * just a touch tighter so travel distance between seats stays short on a
 * small screen (MOBILE_HAND_UI_FIX_REPORT.md follow-up: seats sit ON the
 * orbit, not in a flex-wrap strip above it). OrbitFlow's compact track uses
 * these same radii so the drawn ring visually coincides with where the seats
 * actually are. */
export const COMPACT_RING_RADII: EllipseOptions = { radiusXPct: 35, radiusYPct: 37 };
export function computeCompactRingSeatPoints(count: number): SeatPoint[] {
  return computeSeatPoints(count, COMPACT_RING_RADII);
}

/** The angle (matching computeSeatPoints' own internal math exactly) a given
 * seat index sits at — used by OrbitFlow to draw the current->next turn arc
 * so it lines up with the actual rendered seat positions instead of an
 * independently-guessed angle. */
export function seatAngleDeg(index: number, count: number, options: EllipseOptions = {}): number {
  const { startAngleDeg = -90, arcDeg = 360 } = options;
  if (count <= 1) return startAngleDeg;
  const step = arcDeg / (arcDeg >= 360 ? count : Math.max(count - 1, 1));
  return startAngleDeg + step * index;
}

export function computeSeatPoints(count: number, options: EllipseOptions = {}): SeatPoint[] {
  if (count <= 0) return [];
  const { radiusXPct = 43, radiusYPct = 37, startAngleDeg = -90, arcDeg = 360 } = options;
  if (count === 1) return [{ leftPct: 50, topPct: 50 + radiusYPct * 0.4 }];

  const step = arcDeg / (arcDeg >= 360 ? count : Math.max(count - 1, 1));
  return Array.from({ length: count }, (_, index) => {
    const angleDeg = startAngleDeg + step * index;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      leftPct: 50 + radiusXPct * Math.cos(rad),
      topPct: 50 + radiusYPct * Math.sin(rad),
    };
  });
}
