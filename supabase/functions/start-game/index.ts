import { createNewGame, type NewPlayerSpec } from "../../../src/game/gameState.ts";
import { authenticateDevice } from "../_shared/auth.ts";
import { persistAndBroadcast } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { runBotTurnsUntilHumanOrOver } from "../_shared/botLoop.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { deviceId, sessionToken } = await req.json();
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, deviceId, sessionToken);

    const { data: room } = await admin.from("rooms").select("*").eq("room_id", device.roomId).single();
    if (room.host_device_id !== device.deviceId) return errorResponse("NOT_HOST", "Nur der Host kann das Spiel starten.", 403);
    if (room.status !== "LOBBY") return errorResponse("ROOM_NOT_IN_LOBBY", "Das Spiel läuft bereits.", 409);

    const { data: players, error: playersError } = await admin
      .from("players")
      .select("*")
      .eq("room_id", device.roomId)
      .order("seat_index", { ascending: true });
    if (playersError) throw playersError;
    if (!players || players.length < 2) return errorResponse("NOT_ENOUGH_PLAYERS", "Mindestens 2 Spieler nötig.", 400);

    const specs: NewPlayerSpec[] = players.map((p) => ({
      playerId: p.player_id,
      displayName: p.display_name,
      type: p.player_type,
      botStrategyLevel: p.bot_strategy_level ?? undefined,
    }));

    let state = createNewGame(device.roomId, specs);

    await admin.from("rooms").update({ status: "PLAYING" }).eq("room_id", device.roomId);

    state = await runBotTurnsUntilHumanOrOver(admin, state);
    await persistAndBroadcast(admin, state);

    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
