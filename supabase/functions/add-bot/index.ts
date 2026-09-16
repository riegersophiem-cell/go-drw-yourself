import { authenticateDevice } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { botAvatarForIndex } from "../../../src/game/avatars.ts";

/** Same room-wide cap as join-room — see LOBBY_SESSION_FLOW_REPORT.md (NOT yet deployed). */
const MAX_PLAYERS = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { deviceId, sessionToken, displayName, strategyLevel } = await req.json();
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, deviceId, sessionToken);

    const { data: room } = await admin.from("rooms").select("*").eq("room_id", device.roomId).single();
    if (room.host_device_id !== device.deviceId) return errorResponse("NOT_HOST", "Nur der Host kann Bots hinzufügen.", 403);
    if (room.status !== "LOBBY") return errorResponse("ROOM_NOT_IN_LOBBY", "Bots können nur in der Lobby hinzugefügt werden.", 409);

    const { count: seatedCount } = await admin
      .from("players")
      .select("player_id", { count: "exact", head: true })
      .eq("room_id", device.roomId);
    if ((seatedCount ?? 0) >= MAX_PLAYERS) {
      return errorResponse("ROOM_FULL", "Dieser Raum ist voll.", 409);
    }

    const { data: seatData } = await admin
      .from("players")
      .select("seat_index")
      .eq("room_id", device.roomId)
      .order("seat_index", { ascending: false })
      .limit(1);
    const nextSeat = seatData && seatData.length > 0 ? seatData[0].seat_index + 1 : 0;

    const { count: existingBotCount } = await admin
      .from("players")
      .select("player_id", { count: "exact", head: true })
      .eq("room_id", device.roomId)
      .eq("player_type", "BOT");

    const { data: bot, error } = await admin
      .from("players")
      .insert({
        room_id: device.roomId,
        display_name: displayName ?? `Bot ${nextSeat + 1}`,
        player_type: "BOT",
        seat_index: nextSeat,
        avatar: botAvatarForIndex(existingBotCount ?? 0),
        bot_strategy_level: strategyLevel === "EASY" ? "EASY" : "NORMAL",
      })
      .select()
      .single();
    if (error) throw error;

    return jsonResponse({ playerId: bot.player_id, displayName: bot.display_name });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
