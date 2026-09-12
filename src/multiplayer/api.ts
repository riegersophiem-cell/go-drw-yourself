import { supabase } from "../supabase/client";
import type { GameAction } from "../game/actions";
import type { CardColor, DeviceRole, PrivatePlayerState, PublicGameState } from "../game/types";

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error.message ?? data.error.code);
  return data as T;
}

export interface CreateRoomResult {
  roomId: string;
  roomCode: string;
  deviceId: string;
  sessionToken: string;
  playerId: string;
}

export function createRoom(displayName: string) {
  return invoke<CreateRoomResult>("create-room", { displayName });
}

export interface JoinRoomResult {
  roomId: string;
  roomCode: string;
  deviceId: string;
  sessionToken: string;
  playerId: string | null;
  role: DeviceRole;
}

export function joinRoom(roomCode: string, role: DeviceRole, displayName?: string) {
  return invoke<JoinRoomResult>("join-room", { roomCode, role, displayName });
}

export function addBot(deviceId: string, sessionToken: string, displayName?: string, strategyLevel: "EASY" | "NORMAL" = "NORMAL") {
  return invoke<{ playerId: string; displayName: string }>("add-bot", { deviceId, sessionToken, displayName, strategyLevel });
}

export function removeBot(deviceId: string, sessionToken: string, botPlayerId: string) {
  return invoke<{ ok: true }>("remove-bot", { deviceId, sessionToken, botPlayerId });
}

export function startGame(deviceId: string, sessionToken: string) {
  return invoke<{ ok: true }>("start-game", { deviceId, sessionToken });
}

export function nextRound(deviceId: string, sessionToken: string) {
  return invoke<{ ok: true }>("next-round", { deviceId, sessionToken });
}

export function dispatchAction(deviceId: string, sessionToken: string, action: GameAction) {
  return invoke<{ ownView: PrivatePlayerState }>("dispatch-action", { deviceId, sessionToken, action });
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

export function replaceWithBot(deviceId: string, sessionToken: string, targetPlayerId: string) {
  return invoke<{ ok: true }>("replace-with-bot", { deviceId, sessionToken, targetPlayerId });
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
    .select("player_id, display_name, player_type, seat_index, eliminated, connected, wins")
    .eq("room_id", roomId)
    .order("seat_index", { ascending: true });
  if (error) throw error;
  return data;
}

export type { CardColor };
