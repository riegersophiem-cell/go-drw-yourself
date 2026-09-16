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
    // authenticateDevice throws plain Error("UNKNOWN_DEVICE" |
    // "INVALID_SESSION") — previously every failure here (including these
    // two, the common "reload after clearing storage / stale session on a
    // deleted room" cases) was wrapped as a generic SERVER_ERROR with the
    // raw error string as its message, which the client then displayed
    // verbatim (e.g. "Error: UNKNOWN_DEVICE") instead of a real German
    // message (see LOBBY_SESSION_FLOW_REPORT.md). Both codes now have a
    // translation in src/game/errors.ts, so propagating the real code here
    // is what actually lets the client show it.
    const code = err instanceof Error && (err.message === "UNKNOWN_DEVICE" || err.message === "INVALID_SESSION") ? err.message : "SERVER_ERROR";
    const status = code === "SERVER_ERROR" ? 500 : 401;
    return errorResponse(code, String(err), status);
  }
});
