import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, loadSession, saveSession, type DeviceSession } from "../src/multiplayer/session";

/** Minimal in-memory Storage double — isolated per test, never touches real browser storage. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

/** A Storage double whose every method throws, simulating a fully unavailable storage (private-mode-like). */
class ThrowingStorage implements Storage {
  get length(): number {
    throw new Error("unavailable");
  }
  clear(): void {
    throw new Error("unavailable");
  }
  getItem(): string | null {
    throw new Error("unavailable");
  }
  key(): string | null {
    throw new Error("unavailable");
  }
  removeItem(): void {
    throw new Error("unavailable");
  }
  setItem(): void {
    throw new Error("unavailable");
  }
}

/**
 * An otherwise-working in-memory storage whose `setItem` alone throws (e.g.
 * quota exceeded) — `getItem`/`removeItem` keep working normally. This is
 * the shape a real "write failed" case actually has, and is distinct from
 * `ThrowingStorage`: a storage that throws on *every* call can't expose the
 * "legacy entry must survive a failed write" regression, because the
 * `removeItem` that would destroy it would throw too (masking the bug).
 */
class SetItemFailsStorage extends MemoryStorage {
  setItem(): never {
    throw new Error("quota exceeded");
  }
}

const STORAGE_KEY = "uno_no_mercy_session";

const validSession: DeviceSession = {
  roomId: "room-1",
  roomCode: "AB7K2Q",
  deviceId: "device-1",
  sessionToken: "token-1",
  role: "PLAYER",
  playerId: "player-1",
};

let fakeSessionStorage: MemoryStorage;
let fakeLocalStorage: MemoryStorage;

beforeEach(() => {
  fakeSessionStorage = new MemoryStorage();
  fakeLocalStorage = new MemoryStorage();
  // session.ts reads the bare `sessionStorage`/`localStorage` globals at call
  // time, so replacing them here (isolated per test) is enough — no module
  // mocking or DOM environment needed.
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = fakeSessionStorage;
  (globalThis as unknown as { localStorage: Storage }).localStorage = fakeLocalStorage;
});

describe("saveSession / loadSession round-trip", () => {
  it("saves to sessionStorage and loads it back", () => {
    saveSession(validSession);
    expect(JSON.parse(fakeSessionStorage.getItem(STORAGE_KEY)!)).toEqual(validSession);
    expect(loadSession()).toEqual(validSession);
  });

  it("accepts playerId: null for TABLE/SPECTATOR-style sessions", () => {
    const tableSession: DeviceSession = { ...validSession, role: "TABLE", playerId: null };
    saveSession(tableSession);
    expect(loadSession()).toEqual(tableSession);
  });

  it("never writes to localStorage on save, and clears any legacy entry there", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    saveSession({ ...validSession, roomId: "room-2" });
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("loadSession validation", () => {
  it("returns null when nothing is stored anywhere", () => {
    expect(loadSession()).toBeNull();
  });

  it("returns null for malformed JSON in sessionStorage instead of throwing", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => loadSession()).not.toThrow();
    expect(loadSession()).toBeNull();
  });

  it("rejects a structurally incomplete session (missing sessionToken)", () => {
    const { sessionToken: _sessionToken, ...incomplete } = validSession;
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(incomplete));
    expect(loadSession()).toBeNull();
  });

  it("rejects a session with a wrong-typed field (playerId as number)", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, playerId: 42 }));
    expect(loadSession()).toBeNull();
  });

  it("rejects an unrecognized role", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "ADMIN" }));
    expect(loadSession()).toBeNull();
  });

  it("rejects a non-object value (array)", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(["not", "an", "object"]));
    expect(loadSession()).toBeNull();
  });

  it("does not fall back to a legacy session when this tab's own entry is invalid", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, "{not json");
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    expect(loadSession()).toBeNull();
    // the legacy entry is untouched in this case — it was never inspected
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });
});

describe("legacy localStorage migration", () => {
  it("migrates a valid legacy session into this tab's sessionStorage and removes it from localStorage", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    const result = loadSession();
    expect(result).toEqual(validSession);
    expect(fakeSessionStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(validSession));
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("consumes (removes) an invalid legacy entry without migrating it, and returns null", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadSession()).toBeNull();
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(fakeSessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("only migrates once — a second tab-local load after migration is unaffected by a freshly reappearing legacy entry", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    loadSession();
    // Something else (e.g. another still-open legacy-era tab) writes a
    // *different* value back into localStorage afterwards.
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, roomId: "other-room" }));
    expect(loadSession()).toEqual(validSession);
  });
});

describe("failed writes must never destroy the only persisted copy", () => {
  it("migration: setItem() into sessionStorage fails → legacy entry in localStorage is preserved, not deleted", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new SetItemFailsStorage();

    expect(() => loadSession()).not.toThrow();
    // Documented behavior: the already-validated legacy session is still
    // returned for this one call, so the current page load can reconnect —
    // without pretending the write succeeded or destroying the original.
    expect(loadSession()).toEqual(validSession);
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(validSession));
  });

  it("saveSession(): write to sessionStorage fails → an existing legacy entry is preserved as a fallback", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new SetItemFailsStorage();

    expect(() => saveSession({ ...validSession, roomId: "room-2" })).not.toThrow();
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(validSession));
  });

  it("migration: setItem() succeeds → tab session written AND legacy entry removed", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    const result = loadSession();
    expect(result).toEqual(validSession);
    expect(fakeSessionStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(validSession));
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("invalid legacy session is removed and never migrated, regardless of write outcome", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "NOT_A_ROLE" }));
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new SetItemFailsStorage();

    expect(loadSession()).toBeNull();
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("successful saveSession() writes the tab session and removes any legacy entry", () => {
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    saveSession({ ...validSession, roomId: "room-3" });
    expect(fakeSessionStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ ...validSession, roomId: "room-3" }));
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("role / playerId relationship validation", () => {
  it("accepts PLAYER with a non-empty playerId", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "PLAYER", playerId: "p1" }));
    expect(loadSession()).not.toBeNull();
  });

  it("rejects PLAYER with playerId: null (server contract always seats a player row for PLAYER)", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "PLAYER", playerId: null }));
    expect(loadSession()).toBeNull();
  });

  it("accepts TABLE/SPECTATOR with playerId: null", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "TABLE", playerId: null }));
    expect(loadSession()).not.toBeNull();
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "SPECTATOR", playerId: null }));
    expect(loadSession()).not.toBeNull();
  });

  it("rejects TABLE/SPECTATOR with a non-null playerId (join-room never sets one for these roles)", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "TABLE", playerId: "p1" }));
    expect(loadSession()).toBeNull();
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "SPECTATOR", playerId: "p1" }));
    expect(loadSession()).toBeNull();
  });

  it("HOST_ADMIN: accepted with either playerId shape — no server contract currently issues this role to validate against", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "HOST_ADMIN", playerId: null }));
    expect(loadSession()).not.toBeNull();
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...validSession, role: "HOST_ADMIN", playerId: "p1" }));
    expect(loadSession()).not.toBeNull();
  });
});

describe("clearSession", () => {
  it("removes both this tab's session and any leftover legacy entry", () => {
    fakeSessionStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    fakeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(validSession));
    clearSession();
    expect(fakeSessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("is a no-op that does not throw when nothing was stored", () => {
    expect(() => clearSession()).not.toThrow();
  });
});

describe("storage unavailable (e.g. private mode)", () => {
  it("saveSession does not throw when both storages throw on every access", () => {
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new ThrowingStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new ThrowingStorage();
    expect(() => saveSession(validSession)).not.toThrow();
  });

  it("loadSession returns null instead of throwing when both storages throw", () => {
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new ThrowingStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new ThrowingStorage();
    expect(loadSession()).toBeNull();
  });

  it("clearSession does not throw when both storages throw", () => {
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new ThrowingStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = new ThrowingStorage();
    expect(() => clearSession()).not.toThrow();
  });
});

describe("tab isolation (simulated via two independent sessionStorage instances)", () => {
  it("a save in one 'tab' does not appear in another tab's sessionStorage", () => {
    const tabASessionStorage = fakeSessionStorage;
    const tabBSessionStorage = new MemoryStorage();

    saveSession(validSession); // writes into tabA (the currently-installed global)

    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = tabBSessionStorage;
    expect(loadSession()).toBeNull(); // tab B sees nothing of tab A's save

    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = tabASessionStorage;
    expect(loadSession()).toEqual(validSession); // tab A still has its own
  });
});
