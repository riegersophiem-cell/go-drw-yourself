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

export function saveSession(session: DeviceSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be unavailable (private mode); session simply won't survive reload.
  }
}

export function loadSession(): DeviceSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeviceSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
