import { authenticateDevice } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { persistAndBroadcast, loadGameState } from "../_shared/persist.ts";
import { runBotTurnsUntilHumanOrOver } from "../_shared/botLoop.ts";

/**
 * Host-only: converts a disconnected human player into a bot for the rest of
 * the game. Seat, current hand and card count are untouched — only
 * `player_type` flips from HUMAN to BOT, so no cards are lost or duplicated.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { deviceId, sessionToken, targetPlayerId } = await req.json();
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, deviceId, sessionToken);

    const { data: room } = await admin.from("rooms").select("*").eq("room_id", device.roomId).single();
    if (room.host_device_id !== device.deviceId) return errorResponse("NOT_HOST", "Nur der Host kann dies tun.", 403);

    await admin
      .from("players")
      .update({ player_type: "BOT", bot_strategy_level: "NORMAL" })
      .eq("player_id", targetPlayerId)
      .eq("room_id", device.roomId);

    if (room.status === "PLAYING") {
      let state = await loadGameState(admin, device.roomId);
      state = {
        ...state,
        players: state.players.map((p) => (p.playerId === targetPlayerId ? { ...p, type: "BOT" as const, botStrategyLevel: "NORMAL" as const } : p)),
      };
      state = await runBotTurnsUntilHumanOrOver(admin, state);
      await persistAndBroadcast(admin, state);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
