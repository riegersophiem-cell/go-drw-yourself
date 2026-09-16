// Maps players onto visual table seats. This is intentionally decoupled from
// game turn order (Player.seatIndex) — see supabase/migrations/0009_seat_layout.sql
// and TABLE_UI_IMPLEMENTATION_REPORT.md section 5. A stored `seatOrder` is
// just "which player id renders in which ring slot"; if it's missing, stale,
// or a player left, we fall back to the natural (turn-order) sequence for
// whoever isn't accounted for, so the ring never breaks.

export interface SeatedPlayerLike {
  playerId: string;
}

/**
 * Resolves the actual render order: players present in `seatOrder` keep that
 * relative order, any player NOT in `seatOrder` (new joiner, or no layout
 * saved yet) is appended in their natural array order, and any id in
 * `seatOrder` that no longer corresponds to a seated player is dropped.
 */
export function resolveSeatOrder<T extends SeatedPlayerLike>(players: T[], seatOrder: string[] | null): T[] {
  if (!seatOrder || seatOrder.length === 0) return players;
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const ordered: T[] = [];
  const used = new Set<string>();
  for (const id of seatOrder) {
    const player = byId.get(id);
    if (player && !used.has(id)) {
      ordered.push(player);
      used.add(id);
    }
  }
  for (const player of players) {
    if (!used.has(player.playerId)) ordered.push(player);
  }
  return ordered;
}

/** Swaps two players' visual slots and returns the new seatOrder to persist (player ids only). */
export function swapSeats<T extends SeatedPlayerLike>(orderedPlayers: T[], playerIdA: string, playerIdB: string): string[] {
  const ids = orderedPlayers.map((p) => p.playerId);
  const indexA = ids.indexOf(playerIdA);
  const indexB = ids.indexOf(playerIdB);
  if (indexA === -1 || indexB === -1 || indexA === indexB) return ids;
  [ids[indexA], ids[indexB]] = [ids[indexB], ids[indexA]];
  return ids;
}
