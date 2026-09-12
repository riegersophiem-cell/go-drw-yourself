import { describe, expect, it } from "vitest";
import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, resolveSuccessBody } from "../src/multiplayer/api";

/**
 * `resolveSuccessBody` is the actual 2xx-branch decision used inside
 * `invoke()` (not a reimplementation) — these tests exercise the real
 * production control flow directly.
 */
function expectThrows(data: unknown): { message: string; code: string | undefined } {
  try {
    resolveSuccessBody(data);
  } catch (e) {
    return { message: (e as Error).message, code: (e as { code?: string }).code };
  }
  throw new Error(`expected resolveSuccessBody(${JSON.stringify(data)}) to throw, but it returned successfully`);
}

describe("resolveSuccessBody — 2xx error-signal detection (matches original `data?.error` truthy semantics)", () => {
  it("throws the generic error for an empty error object ({})", () => {
    expect(expectThrows({ error: {} })).toEqual({ message: GENERIC_ERROR_MESSAGE, code: undefined });
  });

  it("throws the generic error when error is a non-empty string", () => {
    expect(expectThrows({ error: "boom" })).toEqual({ message: GENERIC_ERROR_MESSAGE, code: undefined });
  });

  it("throws the generic error when error is an array", () => {
    expect(expectThrows({ error: ["boom"] })).toEqual({ message: GENERIC_ERROR_MESSAGE, code: undefined });
  });

  it("throws the generic error when error is a nonzero number", () => {
    expect(expectThrows({ error: 42 })).toEqual({ message: GENERIC_ERROR_MESSAGE, code: undefined });
  });

  it("does NOT throw for error: null (falsy, matches original semantics)", () => {
    expect(resolveSuccessBody({ error: null })).toEqual({ error: null });
  });

  it("does NOT throw for error: false (falsy)", () => {
    expect(resolveSuccessBody({ error: false })).toEqual({ error: false });
  });

  it("does NOT throw for error: 0 (falsy)", () => {
    expect(resolveSuccessBody({ error: 0 })).toEqual({ error: 0 });
  });

  it("does NOT throw for error: '' (falsy)", () => {
    expect(resolveSuccessBody({ error: "" })).toEqual({ error: "" });
  });

  it("returns the body unchanged when there is no error field at all", () => {
    const body = { ok: true, value: 123 };
    expect(resolveSuccessBody(body)).toBe(body);
  });

  it("returns the body unchanged when the body itself is not an object", () => {
    expect(resolveSuccessBody("just a string")).toBe("just a string");
    expect(resolveSuccessBody(null)).toBe(null);
    expect(resolveSuccessBody(undefined)).toBe(undefined);
  });

  it("uses the known rule-engine translation for a structured error with a recognized code", () => {
    expect(expectThrows({ error: { code: "NOT_YOUR_TURN", message: "server text ignored" } })).toEqual({
      message: "Du bist noch nicht dran.",
      code: "NOT_YOUR_TURN",
    });
  });

  it("uses the server message for a structured error with an unrecognized code", () => {
    expect(expectThrows({ error: { code: "NOT_HOST", message: "Nur der Host darf das." } })).toEqual({
      message: "Nur der Host darf das.",
      code: "NOT_HOST",
    });
  });

  it("ignores a non-string code but still uses a valid message", () => {
    expect(expectThrows({ error: { code: 123, message: "Serverseitige Meldung." } })).toEqual({
      message: "Serverseitige Meldung.",
      code: undefined,
    });
  });

  it("ignores a non-string/empty message and falls back to generic when no usable code exists", () => {
    expect(expectThrows({ error: { code: 123, message: "" } })).toEqual({
      message: GENERIC_ERROR_MESSAGE,
      code: undefined,
    });
  });

  it("never throws a non-Error-shaped value and always produces a non-empty string message", () => {
    const malformed = [{ error: {} }, { error: "boom" }, { error: ["boom"] }, { error: 42 }, { error: { code: {}, message: {} } }];
    for (const body of malformed) {
      const result = expectThrows(body);
      expect(typeof result.message).toBe("string");
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

describe("network fallback message", () => {
  it("does not promise an automatic retry", () => {
    expect(NETWORK_ERROR_MESSAGE.toLowerCase()).not.toContain("wiederhergestellt");
  });
});
