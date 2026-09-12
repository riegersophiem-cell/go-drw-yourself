import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
import { toPublicGameState } from "../../../src/game/gameState.ts";
import { buildPrivatePlayerState } from "../../../src/game/projections.ts";
import type { GameState } from "../../../src/game/types.ts";

/**
 * Writes the full authoritative state plus its public/private projections,
 * then fires a lightweight "state changed" broadcast. Broadcast payload is
 * ONLY the public view — private hands are never sent over realtime, clients
 * pull their own private view afterwards via the get_private_state RPC.
 */
export async function persistAndBroadcast(admin: SupabaseClient, state: GameState) {
  const { error: stateError } = await admin
    .from("game_states")
    .upsert({ room_id: state.roomId, state, version: state.version, updated_at: new Date().toISOString() });
  if (stateError) throw stateError;

  const publicView = toPublicGameState(state, state.phase === "GAME_OVER" ? "FINISHED" : "PLAYING");
  const { error: publicError } = await admin.from("public_game_views").upsert({
    room_id: state.roomId,
    version: state.version,
    view: publicView,
    updated_at: new Date().toISOString(),
  });
  if (publicError) throw publicError;

  const humanPlayers = state.players.filter((p) => p.type === "HUMAN");
  if (humanPlayers.length > 0) {
    const rows = humanPlayers.map((p) => ({
      player_id: p.playerId,
      room_id: state.roomId,
      version: state.version,
      view: buildPrivatePlayerState(state, p.playerId),
      updated_at: new Date().toISOString(),
    }));
    const { error: privateError } = await admin.from("private_player_views").upsert(rows);
    if (privateError) throw privateError;
  }

  const channel = admin.channel(`room:${state.roomId}:public`);
  await channel.send({ type: "broadcast", event: "state_changed", payload: { version: state.version } });
}

export async function loadGameState(admin: SupabaseClient, roomId: string): Promise<GameState> {
  const { data, error } = await admin.from("game_states").select("state").eq("room_id", roomId).single();
  if (error) throw error;
  return data.state as GameState;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 ambiguity
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
