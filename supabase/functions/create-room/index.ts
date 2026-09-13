import { generateRoomCode, generateSessionToken, sha256Hex } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { DEFAULT_HUMAN_AVATAR, isHumanAvatarId } from "../../../src/game/avatars.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { displayName, avatar } = await req.json();
    if (!displayName || typeof displayName !== "string") return errorResponse("INVALID_INPUT", "displayName required");
    const playerAvatar = isHumanAvatarId(avatar) ? avatar : DEFAULT_HUMAN_AVATAR;

    const admin = supabaseAdmin();

    let roomCode = generateRoomCode();
    // Extremely unlikely collision, but retry a few times to be safe.
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await admin.from("rooms").select("room_id").eq("room_code", roomCode).maybeSingle();
      if (!existing) break;
      roomCode = generateRoomCode();
    }

    const { data: room, error: roomError } = await admin
      .from("rooms")
      .insert({ room_code: roomCode, status: "LOBBY" })
      .select()
      .single();
    if (roomError) throw roomError;

    const { data: player, error: playerError } = await admin
      .from("players")
      .insert({ room_id: room.room_id, display_name: displayName, player_type: "HUMAN", seat_index: 0, avatar: playerAvatar })
      .select()
      .single();
    if (playerError) throw playerError;

    const sessionToken = generateSessionToken();
    const sessionTokenHash = await sha256Hex(sessionToken);
    const { data: device, error: deviceError } = await admin
      .from("devices")
      .insert({ room_id: room.room_id, role: "PLAYER", player_id: player.player_id, session_token_hash: sessionTokenHash })
      .select()
      .single();
    if (deviceError) throw deviceError;

    await admin.from("players").update({ device_id: device.device_id }).eq("player_id", player.player_id);
    await admin.from("rooms").update({ host_device_id: device.device_id }).eq("room_id", room.room_id);

    return jsonResponse({
      roomId: room.room_id,
      roomCode: room.room_code,
      deviceId: device.device_id,
      sessionToken,
      playerId: player.player_id,
    });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
