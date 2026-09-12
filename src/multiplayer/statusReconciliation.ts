/**
 * Decides whether a background room-status reconciliation read (started at
 * `versionAtRequestStart`) may still be applied.
 *
 * RoomPage's skip-reconnect path renders a server-confirmed "LOBBY" status
 * immediately, then — once the realtime subscription is fully active —
 * re-reads the room's real status in the background as a safety net for
 * whatever happened in the gap between the confirmed create/join and the
 * subscription going live. That read is a plain async request and can
 * resolve after a realtime update has already moved the status on (e.g. the
 * host started the game while the read was in flight); applying it then
 * would silently roll the UI back to a stale value.
 *
 * `currentVersion` is a counter bumped by every authoritative status update
 * (every realtime event, and the reconciliation's own application). If it no
 * longer matches the version captured when the reconciliation read started,
 * something newer has already landed and the read must be discarded. The
 * same applies if the room changed underneath it (`requestRoomId` no longer
 * matches `currentRoomId`) or the owning effect already tore down
 * (`cancelled`).
 *
 * Deliberately not a "newer status always wins" ordinal check: the room's
 * status is not a simple LOBBY < PLAYING < FINISHED ladder — `next-round`
 * legitimately moves a FINISHED room back to PLAYING for the next round —
 * so "is this read still the most recently *started* one" is the only
 * ordering that's actually safe to assume here.
 */
export function shouldApplyStatusReconciliation(params: {
  versionAtRequestStart: number;
  currentVersion: number;
  requestRoomId: string;
  currentRoomId: string | undefined;
  cancelled: boolean;
}): boolean {
  return !params.cancelled && params.requestRoomId === params.currentRoomId && params.versionAtRequestStart === params.currentVersion;
}
