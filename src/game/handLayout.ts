// Central hand row-layout algorithm. Single source of truth for how many rows
// a hand of N cards uses and how many cards land in each row — shared by
// TABLE_DEVICE, REMOTE_MOBILE_FULL and PLAYER_HAND_ONLY so all three render
// identical hand geometry, just at different card sizes.
//
// Binding rule (see TABLE_UI_IMPLEMENTATION_REPORT.md section 10):
//   1-10 cards  -> 1 row
//   11-20 cards -> 2 rows
//   21+ cards   -> 3 rows
// Cards are split as evenly as possible across the active rows; any
// remainder is handed to the earlier rows first (row 1, then row 2, ...).

export function rowCountForHandSize(cardCount: number): 1 | 2 | 3 {
  if (cardCount <= 10) return 1;
  if (cardCount <= 20) return 2;
  return 3;
}

/** Cards-per-row, front-loaded: e.g. 13 cards / 2 rows -> [7, 6]; 22 cards / 3 rows -> [8, 7, 7]. */
export function distributeCardsAcrossRows(cardCount: number, rows: number): number[] {
  if (rows <= 0) return [];
  const base = Math.floor(cardCount / rows);
  const remainder = cardCount % rows;
  return Array.from({ length: rows }, (_, rowIndex) => base + (rowIndex < remainder ? 1 : 0));
}

export interface HandRowLayout {
  rowCounts: number[]; // e.g. [7, 6] for 13 cards
}

export function computeHandRowLayout(cardCount: number): HandRowLayout {
  const rows = rowCountForHandSize(cardCount);
  return { rowCounts: distributeCardsAcrossRows(cardCount, rows) };
}

/** Slices a flat card array into per-row chunks using computeHandRowLayout's counts, in order. */
export function splitIntoRows<T>(cards: T[], rowCounts: number[]): T[][] {
  const rowsArr: T[][] = [];
  let cursor = 0;
  for (const count of rowCounts) {
    rowsArr.push(cards.slice(cursor, cursor + count));
    cursor += count;
  }
  return rowsArr;
}
