import { authenticateDevice } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

/**
 * Called on page load / reload. The client only ever persists
 * {roomId, deviceId, sessionToken} locally — never card data — so a reload
 * or brief disconnect can never destroy or leak the game state.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { deviceId, sessionToken } = await req.json();
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, deviceId, sessionToken);

    await admin.from("devices").update({ connected: true, last_seen_at: new Date().toISOString() }).eq("device_id", deviceId);
    if (device.playerId) {
      await admin.from("players").update({ connected: true }).eq("player_id", device.playerId);
    }

    const { data: room } = await admin.from("rooms").select("*").eq("room_id", device.roomId).single();
    const { data: publicView } = await admin.from("public_game_views").select("view").eq("room_id", device.roomId).maybeSingle();

    return jsonResponse({
      roomId: device.roomId,
      roomCode: room.room_code,
      roomStatus: room.status,
      role: device.role,
      playerId: device.playerId,
      publicState: publicView?.view ?? null,
    });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
