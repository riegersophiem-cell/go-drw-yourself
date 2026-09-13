import type { DeviceRole } from "../game/types";

// Only these three values are ever persisted locally. Never store hand
// contents here — a reload must never be able to leak or fabricate cards.
export interface DeviceSession {
  roomId: string;
  roomCode: string;
  deviceId: string;
  sessionToken: string;
  role: DeviceRole;
  playerId: string | null;
}

const STORAGE_KEY = "uno_no_mercy_session";
const RECOVERY_STORAGE_KEY = "uno_no_mercy_recovery_sessions";

const VALID_ROLES: readonly DeviceRole[] = ["PLAYER", "TABLE", "SPECTATOR", "HOST_ADMIN"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Runtime shape check for anything read back from storage — never trust a
 * `JSON.parse(...) as DeviceSession` type assertion here. Storage content is
 * as untrusted as any other external input: it can be corrupted, edited by
 * hand, or left over from an older/incompatible version of this app.
 *
 * `playerId` is checked against `role` per the actual server contract (see
 * `supabase/functions/create-room` and `join-room`): a `PLAYER` device is
 * always tied to a seated player row (`playerId` a non-empty string), while
 * `TABLE`/`SPECTATOR` devices never get one (`playerId` must be `null`) —
 * `join-room` only ever sets `playerId` when `role === "PLAYER"`.
 *
 * `HOST_ADMIN` is a valid enum value at the DB level (see the `role` check
 * constraint in `0001_init.sql`) but is not currently produced by any Edge
 * Function — `create-room` always inserts `"PLAYER"`, and `join-room`
 * rejects any role outside `PLAYER`/`TABLE`/`SPECTATOR`. With no server
 * contract to validate against, this deliberately does not invent a
 * `playerId` rule for it: either `null` or a non-empty string is accepted,
 * same as the general base check.
 */
function isDeviceSession(value: unknown): value is DeviceSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    !(
      isNonEmptyString(v.roomId) &&
      isNonEmptyString(v.roomCode) &&
      isNonEmptyString(v.deviceId) &&
      isNonEmptyString(v.sessionToken) &&
      typeof v.role === "string" &&
      (VALID_ROLES as string[]).includes(v.role) &&
      (v.playerId === null || isNonEmptyString(v.playerId))
    )
  ) {
    return false;
  }
  if (v.role === "PLAYER") return isNonEmptyString(v.playerId);
  if (v.role === "TABLE" || v.role === "SPECTATOR") return v.playerId === null;
  return true; // HOST_ADMIN: no server contract yet to validate playerId against
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Every storage access is wrapped individually — not just `setItem`/`getItem`
 * calls, but the `sessionStorage`/`localStorage` global lookup itself, since
 * some browsers (older Safari private mode, embedding contexts with storage
 * disabled by policy) can throw on merely touching the object.
 */
function readRaw(storage: () => Storage, key = STORAGE_KEY): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/**
 * Returns whether the write actually succeeded. Callers that remove a
 * *different* copy of the session (e.g. a legacy entry) after writing this
 * one MUST check this before doing so — otherwise a failed `setItem` (quota
 * exceeded, storage disabled by policy, etc.) can silently destroy the only
 * remaining persisted copy of the session.
 */
function writeRaw(storage: () => Storage, value: string, key = STORAGE_KEY): boolean {
  try {
    storage().setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(storage: () => Storage, key = STORAGE_KEY): void {
  try {
    storage().removeItem(key);
  } catch {
    // ignore
  }
}

const tabStorage = () => sessionStorage;
const legacyStorage = () => localStorage;

function readRecoverySession(roomId: string): DeviceSession | null {
  const parsed = safeParse(readRaw(legacyStorage, RECOVERY_STORAGE_KEY) ?? "null");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const candidate = (parsed as Record<string, unknown>)[roomId];
  return isDeviceSession(candidate) && candidate.roomId === roomId ? candidate : null;
}

function saveRecoverySession(session: DeviceSession): boolean {
  const parsed = safeParse(readRaw(legacyStorage, RECOVERY_STORAGE_KEY) ?? "{}");
  const sessions = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? { ...(parsed as Record<string, unknown>) }
    : {};
  sessions[session.roomId] = session;
  return writeRaw(legacyStorage, JSON.stringify(sessions), RECOVERY_STORAGE_KEY);
}

function removeRecoverySession(roomId: string): void {
  const parsed = safeParse(readRaw(legacyStorage, RECOVERY_STORAGE_KEY) ?? "null");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
  const sessions = { ...(parsed as Record<string, unknown>) };
  delete sessions[roomId];
  if (Object.keys(sessions).length === 0) removeRaw(legacyStorage, RECOVERY_STORAGE_KEY);
  else writeRaw(legacyStorage, JSON.stringify(sessions), RECOVERY_STORAGE_KEY);
}

/**
 * Keeps the active tab isolated in `sessionStorage` and also stores a
 * room-keyed recovery credential in `localStorage`. The recovery copy is
 * only considered when RoomPage supplies the exact room id from its URL, so
 * opening an unrelated tab never silently adopts another tab's identity.
 * Neither copy contains game state or cards; reconnect always reloads those
 * from the server.
 */
export function saveSession(session: DeviceSession): void {
  const encoded = JSON.stringify(session);
  const wroteTab = writeRaw(tabStorage, encoded);
  const wroteRecovery = saveRecoverySession(session);
  if (wroteTab || wroteRecovery) removeRaw(legacyStorage); // consume the pre-recovery-format legacy slot only after a confirmed replacement
}

/**
 * Reads this tab's own session first. Only when this tab has never had one
 * yet (no key present at all) does it fall back to a one-time migration of
 * a still-valid legacy `localStorage` session.
 *
 * An invalid/corrupt value already present in *this tab's own* storage is
 * deliberately never papered over by falling through to the legacy entry —
 * that would silently resurrect a stale global session under a tab that
 * either never had one or explicitly cleared its own, which is exactly the
 * cross-tab bleed this module exists to prevent.
 *
 * Migration order matters: the legacy value is validated *before* anything
 * is written or removed, and the legacy entry is only removed once it has
 * been confirmed written to this tab's own storage. If that write fails, the
 * legacy entry is kept — but the already-validated session is still
 * returned for this call, so the page that's loading right now can still
 * reconnect. Every subsequent `loadSession()` call in this tab will retry
 * the same migration (this tab's own slot is still empty) until the write
 * eventually succeeds; the original persisted session is never destroyed on
 * the strength of a write that didn't actually happen. An invalid legacy
 * entry, on the other hand, is removed regardless of write outcome (there's
 * nothing valid to preserve, and leaving it would just retry forever).
 *
 * Not a fully atomic migration: two tabs opened at nearly the same moment
 * can both call this before either has removed the legacy entry, so both
 * may successfully adopt a copy — or, if one's read/remove interleaves
 * before the other's read, the second may find it already gone and end up
 * with no session at all. Either outcome is safe (no corruption, no crash),
 * just not a guaranteed migration for every simultaneously-opened tab; a
 * full guarantee would need a cross-tab lock, which is more machinery than
 * this one-time convenience migration warrants.
 */
export function loadSession(roomId?: string): DeviceSession | null {
  const ownRaw = readRaw(tabStorage);
  if (ownRaw !== null) {
    const parsed = safeParse(ownRaw);
    return isDeviceSession(parsed) ? parsed : null;
  }

  if (roomId) {
    const recovery = readRecoverySession(roomId);
    if (recovery) {
      writeRaw(tabStorage, JSON.stringify(recovery));
      return recovery;
    }
  }

  const legacyRaw = readRaw(legacyStorage);
  if (legacyRaw === null) return null;

  const legacyParsed = safeParse(legacyRaw);
  if (!isDeviceSession(legacyParsed)) {
    removeRaw(legacyStorage); // nothing valid to preserve — consume it so it isn't retried forever
    return null;
  }

  if (roomId && legacyParsed.roomId !== roomId) return null;
  const migrated = writeRaw(tabStorage, legacyRaw);
  if (migrated) {
    saveRecoverySession(legacyParsed);
    removeRaw(legacyStorage);
  }
  // Return the validated session either way: on success it's now this tab's
  // own copy; on failure it's still safe to use for this one page load,
  // and the untouched legacy entry remains available to retry from.
  return legacyParsed;
}

export function clearSession(): void {
  const ownParsed = safeParse(readRaw(tabStorage) ?? "null");
  if (isDeviceSession(ownParsed)) removeRecoverySession(ownParsed.roomId);
  removeRaw(tabStorage);
  removeRaw(legacyStorage);
}
