import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { lookupGameErrorMessage } from "../game/errors";
import { supabase } from "../supabase/client";
import type { GameAction } from "../game/actions";
import type { GameEventBatch } from "../game/gameEvents";
import type { CardColor, DeviceRole, PrivatePlayerState, PublicGameState } from "../game/types";
import type { HumanAvatarId } from "../game/avatars";

export const NETWORK_ERROR_MESSAGE = "Verbindung zum Spiel fehlgeschlagen. Bitte versuche es erneut.";
export const GENERIC_ERROR_MESSAGE = "Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.";

/** Error class used for every failure `invoke()` throws, so callers can read `.code` when present. */
class InvokeError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "InvokeError";
    this.code = code;
  }
}

interface StructuredError {
  code?: string;
  message?: string;
}

/**
 * Reads the `error` field off a body, using the *same truthy test the
 * original production code used* (`data?.error`) to decide whether an error
 * is signaled at all: `null`, `false`, `0`, `""`, or a missing field are not
 * a signal (matches the pre-existing behavior); any other truthy value is —
 * regardless of its shape. Returns `undefined` when there is no signal.
 */
function getErrorField(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return undefined;
  const value = (body as Record<string, unknown>).error;
  return value ? value : undefined;
}

/**
 * Safely reads `{ code, message }` off an error value that is *supposed* to
 * be `{ code, message }` but, since it comes either from parsed JSON off the
 * wire or from a technically-successful response body, cannot be trusted to
 * actually have that shape (it may be a string, array, number, or an object
 * with wrong-typed fields).
 *
 * Only accepts `code` if it is a string, and `message` if it is a non-empty
 * string; any other shape safely yields an empty result instead of throwing
 * or passing through a value unsuitable for use as an `Error` message.
 */
function extractCodeAndMessage(errorField: unknown): StructuredError {
  if (typeof errorField !== "object" || errorField === null || Array.isArray(errorField)) return {};
  const raw = errorField as Record<string, unknown>;
  const code = typeof raw.code === "string" ? raw.code : undefined;
  const message = typeof raw.message === "string" && raw.message.length > 0 ? raw.message : undefined;
  return { code, message };
}

/** code (via the shared rule-engine translation table) → server-supplied message → generic fallback. */
function resolveMessage(code: string | undefined, serverMessage: string | undefined): string {
  if (code) {
    const known = lookupGameErrorMessage(code);
    if (known) return known;
  }
  if (serverMessage) return serverMessage;
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Reads the JSON body off a `FunctionsHttpError`'s response. Every Edge
 * Function in this project responds to a rejected call with a non-2xx
 * status AND a `{ error: { code, message } }` body — but `supabase-js`
 * itself only exposes a generic "Edge Function returned a non-2xx status
 * code" on `error.message` for this case, never the actual body, unless it
 * is explicitly read back off `error.context` (the underlying Response).
 * This never throws: an empty, non-JSON, or unexpectedly-shaped body
 * resolves to `{}`.
 */
async function readHttpErrorBody(error: FunctionsHttpError): Promise<StructuredError> {
  try {
    const response: Response | undefined = error.context;
    if (!response) return {};
    const clonable = typeof response.clone === "function" ? response.clone() : response;
    const text = await clonable.text();
    if (!text) return {};
    const parsed: unknown = JSON.parse(text);
    return extractCodeAndMessage(getErrorField(parsed));
  } catch {
    return {};
  }
}

/**
 * The real 2xx decision from `invoke()`, pulled out so it can be exercised
 * directly by tests without duplicating its logic: throws whenever `data`
 * carries a truthy `error` field (matching the original `data?.error`
 * semantics), using `extractCodeAndMessage`/`resolveMessage` to turn a
 * structured error value into a translated message, and falling back to the
 * generic message for a truthy-but-unstructured one. Returns `data`
 * unchanged when there is no error signal.
 */
export function resolveSuccessBody<T>(data: unknown): T {
  const errorField = getErrorField(data);
  if (errorField !== undefined) {
    const { code, message } = extractCodeAndMessage(errorField);
    throw new InvokeError(resolveMessage(code, message), code);
  }
  return data as T;
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const { code, message } = await readHttpErrorBody(error);
      throw new InvokeError(resolveMessage(code, message), code);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new InvokeError(NETWORK_ERROR_MESSAGE);
    }
    // Unrecognized error shape from the client library — never surface its raw message.
    throw new InvokeError(GENERIC_ERROR_MESSAGE);
  }

  // A technically-successful (2xx) response whose body still carries an error signal.
  return resolveSuccessBody<T>(data);
}

export interface CreateRoomResult {
  roomId: string;
  roomCode: string;
  deviceId: string;
  sessionToken: string;
  playerId: string;
}

export function createRoom(displayName: string, avatar: HumanAvatarId) {
  return invoke<CreateRoomResult>("create-room", { displayName, avatar });
}

export interface JoinRoomResult {
  roomId: string;
  roomCode: string;
  deviceId: string;
  sessionToken: string;
  playerId: string | null;
  role: DeviceRole;
}

export function joinRoom(roomCode: string, role: DeviceRole, displayName?: string, avatar?: HumanAvatarId) {
  return invoke<JoinRoomResult>("join-room", { roomCode, role, displayName, avatar });
}

export function addBot(deviceId: string, sessionToken: string, displayName?: string, strategyLevel: "EASY" | "NORMAL" = "NORMAL") {
  return invoke<{ playerId: string; displayName: string }>("add-bot", { deviceId, sessionToken, displayName, strategyLevel });
}

export function removeBot(deviceId: string, sessionToken: string, botPlayerId: string) {
  return invoke<{ ok: true }>("remove-bot", { deviceId, sessionToken, botPlayerId });
}

export interface MutationBatchResult { ok: true; batch: GameEventBatch; gameId: string; version: number }

export interface MutationContext {
  actionId: string;
  expectedGameId: string | null;
  expectedVersion: number | null;
}

export function startGame(deviceId: string, sessionToken: string, context: MutationContext) {
  return invoke<MutationBatchResult>("start-game", { deviceId, sessionToken, ...context });
}

export function nextRound(deviceId: string, sessionToken: string, context: MutationContext) {
  return invoke<MutationBatchResult>("next-round", { deviceId, sessionToken, ...context });
}

export function dispatchAction(deviceId: string, sessionToken: string, action: GameAction, context: MutationContext) {
  const actionWithVersion: GameAction = {
    ...action,
    expectedVersion: context.expectedVersion ?? undefined,
  };
  return invoke<{ ownView: PrivatePlayerState; batch: GameEventBatch; gameId: string; version: number }>("dispatch-action", {
    deviceId,
    sessionToken,
    action: actionWithVersion,
    ...context,
  });
}

export interface ReconnectResult {
  roomId: string;
  roomCode: string;
  roomStatus: string;
  role: DeviceRole;
  playerId: string | null;
  publicState: PublicGameState | null;
}

export function reconnect(deviceId: string, sessionToken: string) {
  return invoke<ReconnectResult>("reconnect", { deviceId, sessionToken });
}

export function replaceWithBot(deviceId: string, sessionToken: string, targetPlayerId: string, context: MutationContext) {
  return invoke<MutationBatchResult>("replace-with-bot", { deviceId, sessionToken, targetPlayerId, ...context });
}

export async function fetchPrivateState(deviceId: string, sessionToken: string): Promise<PrivatePlayerState | null> {
  const { data, error } = await supabase.rpc("get_private_state", { p_device_id: deviceId, p_session_token: sessionToken });
  if (error) throw error;
  return (data as PrivatePlayerState | null) ?? null;
}

export async function fetchPublicState(roomId: string): Promise<PublicGameState | null> {
  const { data, error } = await supabase.from("public_game_views").select("view").eq("room_id", roomId).maybeSingle();
  if (error) throw error;
  return (data?.view as PublicGameState | undefined) ?? null;
}

export async function fetchPlayers(roomId: string) {
  const { data, error } = await supabase
    .from("players")
    .select("player_id, display_name, player_type, avatar, seat_index, eliminated, connected, wins")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });
  if (error) throw error;
  return data;
}

export type { CardColor };
