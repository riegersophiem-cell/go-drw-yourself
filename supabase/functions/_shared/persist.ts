import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
import { toPublicGameState } from "../../../src/game/gameState.ts";
import { buildPrivatePlayerState } from "../../../src/game/projections.ts";
import type { PendingGameEvent } from "../../../src/game/gameEvents.ts";
import type { GameState, RoomStatus } from "../../../src/game/types.ts";

export type TransitionMode = "START_GAME" | "NEXT_ROUND" | "NORMAL_ACTION";
export interface PersistTurnBatchOptions {
  transitionMode: TransitionMode;
  expectedGameId: string | null;
  expectedVersion: number | null;
  batchFromVersion: number;
  actionId: string;
  roomStatus: Exclude<RoomStatus, "LOBBY">;
  winnerPlayerId?: string | null;
  replacedPlayerId?: string | null;
  events?: PendingGameEvent[];
}

export async function persistTurnBatch(admin: SupabaseClient, state: GameState, options: PersistTurnBatchOptions) {
  const publicView = toPublicGameState(state, options.roomStatus);
  const privateViews = state.players.filter((p) => p.type === "HUMAN" && !p.eliminated && p.connected).map((p) => ({
    player_id: p.playerId,
    view: buildPrivatePlayerState(state, p.playerId),
  }));
  const { data, error } = await admin.rpc("apply_turn_batch", {
    p_room_id: state.roomId,
    p_transition_mode: options.transitionMode,
    p_expected_game_id: options.expectedGameId,
    p_expected_version: options.expectedVersion,
    p_batch_from_version: options.batchFromVersion,
    p_action_id: options.actionId,
    p_new_state: state,
    p_public_view: publicView,
    p_private_views: privateViews,
    p_events: options.events ?? [],
    p_room_status: options.roomStatus,
    p_winner_player_id: options.winnerPlayerId ?? null,
    p_replaced_player_id: options.replacedPlayerId ?? null,
  });
  if (error) throw error;
  const response = data as { ok: true; gameId: string; version: number; batchId: string };
  const batch = { gameId: state.gameId, batchId: options.actionId, fromVersion: options.batchFromVersion, toVersion: state.version, events: options.events ?? [] };
  const channel = admin.channel(`room:${state.roomId}:public`);
  await channel.send({ type: "broadcast", event: "state_changed", payload: batch });
  return { response, batch, publicView, privateViews };
}

export async function loadGameState(admin: SupabaseClient, roomId: string): Promise<GameState> {
  const { data, error } = await admin.from("game_states").select("state").eq("room_id", roomId).single();
  if (error) throw error;
  return data.state as GameState;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export function generateSessionToken(): string { const bytes=new Uint8Array(32); crypto.getRandomValues(bytes); return Array.from(bytes).map((b)=>b.toString(16).padStart(2,"0")).join(""); }
export function generateRoomCode(): string { const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let code=""; for(let i=0;i<6;i++) code+=alphabet[Math.floor(Math.random()*alphabet.length)]; return code; }
