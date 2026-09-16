import { describe, expect, it } from "vitest";
import { computeHandRowLayout, rowCountForHandSize } from "../src/game/handLayout";

describe("rowCountForHandSize", () => {
  it.each([
    [1, 1], [5, 1], [10, 1],
    [11, 2], [13, 2], [20, 2],
    [21, 3], [22, 3], [30, 3], [50, 3],
  ])("%i cards -> %i rows", (count, expected) => {
    expect(rowCountForHandSize(count)).toBe(expected);
  });
});

describe("computeHandRowLayout — binding row distribution", () => {
  it.each([
    [5, [5]],
    [10, [10]],
    [11, [6, 5]],
    [12, [6, 6]],
    [13, [7, 6]],
    [14, [7, 7]],
    [15, [8, 7]],
    [20, [10, 10]],
    [21, [7, 7, 7]],
    [22, [8, 7, 7]],
    [23, [8, 8, 7]],
    [24, [8, 8, 8]],
    [30, [10, 10, 10]],
  ])("%i cards -> rows %j", (count, expectedRows) => {
    expect(computeHandRowLayout(count).rowCounts).toEqual(expectedRows);
  });

  it("sums back to the original card count for every tested size", () => {
    for (let n = 0; n <= 40; n++) {
      const { rowCounts } = computeHandRowLayout(n);
      expect(rowCounts.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});
