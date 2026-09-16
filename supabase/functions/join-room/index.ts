import { generateSessionToken, sha256Hex } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { DEFAULT_HUMAN_AVATAR, isHumanAvatarId } from "../../../src/game/avatars.ts";

/** Matches the seat-ellipse/dev-harness assumption elsewhere (computeFullRingSeatPoints callers cap at 8) — not previously enforced server-side. */
const MAX_PLAYERS = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { roomCode, role, displayName, avatar } = await req.json();
    if (!roomCode || !role) return errorResponse("INVALID_INPUT", "roomCode and role required");
    const playerAvatar = isHumanAvatarId(avatar) ? avatar : DEFAULT_HUMAN_AVATAR;
    if (!["PLAYER", "TABLE", "SPECTATOR"].includes(role)) return errorResponse("INVALID_INPUT", "invalid role");
    if (role === "PLAYER" && !displayName) return errorResponse("INVALID_INPUT", "displayName required for PLAYER");

    const admin = supabaseAdmin();

    const { data: room, error: roomError } = await admin
      .from("rooms")
      .select("*")
      .eq("room_code", roomCode.toUpperCase())
      .maybeSingle();
    if (roomError) throw roomError;
    if (!room) return errorResponse("ROOM_NOT_FOUND", "Kein Raum mit diesem Code gefunden.", 404);
    // TABLE/SPECTATOR devices may join at any time (a table display can be
    // added mid-game); only new PLAYER seats require the lobby phase.
    if (role === "PLAYER" && room.status !== "LOBBY") {
      return errorResponse("ROOM_NOT_JOINABLE", "Dieses Spiel läuft bereits oder ist beendet.", 409);
    }

    let playerId: string | null = null;

    if (role === "PLAYER") {
      // No cap existed anywhere before this — join-room and add-bot could
      // seat an unbounded number of players (the client/dev-harness code
      // elsewhere already assumes a max of 8, e.g. computeFullRingSeatPoints
      // callers). MAX_PLAYERS below is that same limit made an actual server
      // rule instead of an unenforced assumption (see
      // LOBBY_SESSION_FLOW_REPORT.md — NOT yet deployed).
      const { count: seatedCount } = await admin
        .from("players")
        .select("player_id", { count: "exact", head: true })
        .eq("room_id", room.room_id);
      if ((seatedCount ?? 0) >= MAX_PLAYERS) {
        return errorResponse("ROOM_FULL", "Dieser Raum ist voll.", 409);
      }

      const { data: seatData } = await admin
        .from("players")
        .select("seat_index")
        .eq("room_id", room.room_id)
        .order("seat_index", { ascending: false })
        .limit(1);
      const nextSeat = seatData && seatData.length > 0 ? seatData[0].seat_index + 1 : 0;

      const { data: player, error: playerError } = await admin
        .from("players")
        .insert({ room_id: room.room_id, display_name: displayName, player_type: "HUMAN", seat_index: nextSeat, avatar: playerAvatar })
        .select()
        .single();
      if (playerError) throw playerError;
      playerId = player.player_id;
    }

    const sessionToken = generateSessionToken();
    const sessionTokenHash = await sha256Hex(sessionToken);
    const { data: device, error: deviceError } = await admin
      .from("devices")
      .insert({ room_id: room.room_id, role, player_id: playerId, session_token_hash: sessionTokenHash })
      .select()
      .single();
    if (deviceError) throw deviceError;

    if (playerId) {
      await admin.from("players").update({ device_id: device.device_id }).eq("player_id", playerId);
    }

    return jsonResponse({
      roomId: room.room_id,
      roomCode: room.room_code,
      deviceId: device.device_id,
      sessionToken,
      playerId,
      role,
    });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
