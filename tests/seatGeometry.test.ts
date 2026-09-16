import { describe, expect, it } from "vitest";
import { computeSeatPoints } from "../src/game/seatGeometry";

function approx(a: number, b: number, eps = 0.5) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("computeSeatPoints — mathematical ellipse seating", () => {
  it("returns exactly N points for N seats, for 2 through 8 players", () => {
    for (let n = 2; n <= 8; n++) {
      expect(computeSeatPoints(n)).toHaveLength(n);
    }
  });

  it("2 players sit opposite each other (top and bottom, same horizontal center)", () => {
    const [a, b] = computeSeatPoints(2);
    approx(a.leftPct, 50);
    approx(b.leftPct, 50);
    expect(Math.abs(a.topPct - b.topPct)).toBeGreaterThan(50);
  });

  it("all seats stay within the 0-100 percentage bounding box", () => {
    for (let n = 1; n <= 10; n++) {
      for (const seat of computeSeatPoints(n)) {
        expect(seat.leftPct).toBeGreaterThanOrEqual(0);
        expect(seat.leftPct).toBeLessThanOrEqual(100);
        expect(seat.topPct).toBeGreaterThanOrEqual(0);
        expect(seat.topPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("seats are evenly spaced (equal angular step) around a full ellipse", () => {
    const points = computeSeatPoints(6);
    const angles = points.map((p) => Math.atan2((p.topPct - 50) / 37, (p.leftPct - 50) / 43));
    const diffs = angles.map((a, i) => {
      const next = angles[(i + 1) % angles.length];
      let d = next - a;
      if (d <= 0) d += 2 * Math.PI;
      return d;
    });
    for (const d of diffs) approx(d, (2 * Math.PI) / 6, 0.05);
  });

  it("supports a restricted arc for the mobile half-ellipse ring", () => {
    const points = computeSeatPoints(3, { arcDeg: 180, startAngleDeg: 0 });
    expect(points).toHaveLength(3);
    approx(points[0].leftPct, 93); // angle 0deg -> rightmost point
    approx(points[2].leftPct, 7); // angle 180deg -> leftmost point
  });
});
