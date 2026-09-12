import { authenticateDevice } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

/** Host-only, lobby-only: removes a bot before the game has started. */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { deviceId, sessionToken, botPlayerId } = await req.json();
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, deviceId, sessionToken);

    const { data: room } = await admin.from("rooms").select("*").eq("room_id", device.roomId).single();
    if (room.host_device_id !== device.deviceId) return errorResponse("NOT_HOST", "Nur der Host kann Bots entfernen.", 403);
    if (room.status !== "LOBBY") return errorResponse("ROOM_NOT_IN_LOBBY", "Bots können nur in der Lobby entfernt werden.", 409);

    const { data: bot } = await admin.from("players").select("*").eq("player_id", botPlayerId).eq("room_id", device.roomId).single();
    if (!bot || bot.player_type !== "BOT") return errorResponse("NOT_A_BOT", "Dieser Spieler ist kein Bot.", 400);

    const { error } = await admin.from("players").delete().eq("player_id", botPlayerId);
    if (error) throw error;

    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
