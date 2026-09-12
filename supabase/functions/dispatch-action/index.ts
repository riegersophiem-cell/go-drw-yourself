import { dispatchGameAction, type GameAction } from "../../../src/game/actions.ts";
import { buildPrivatePlayerState } from "../../../src/game/projections.ts";
import { GameError } from "../../../src/game/errors.ts";
import { authenticateDevice } from "../_shared/auth.ts";
import { loadGameState, persistAndBroadcast } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { runBotTurnsUntilHumanOrOver } from "../_shared/botLoop.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });

  try {
    const { deviceId, sessionToken, action } = (await req.json()) as {
      deviceId: string;
      sessionToken: string;
      action: GameAction;
    };
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, deviceId, sessionToken);

    if (device.role !== "PLAYER" || !device.playerId) {
      return errorResponse("NOT_A_PLAYER", "Nur Spieler-Geräte können Spielzüge senden.", 403);
    }

    let state = await loadGameState(admin, device.roomId);

    try {
      state = dispatchGameAction(state, device.playerId, action);
    } catch (e) {
      if (e instanceof GameError) return errorResponse(e.code, e.message, 409);
      throw e;
    }

    await admin.from("game_events").insert({
      room_id: device.roomId,
      turn_number: state.turnNumber,
      actor_player_id: device.playerId,
      action_type: action.type,
      public_payload: { action: action.type },
    });

    state = await runBotTurnsUntilHumanOrOver(admin, state);
    await persistAndBroadcast(admin, state);

    if (device.playerId) {
      await admin.from("rooms").update({ status: state.phase === "GAME_OVER" ? "FINISHED" : "PLAYING" }).eq("room_id", device.roomId);
    }

    if (state.phase === "GAME_OVER" && state.winnerPlayerId) {
      const { data: winner } = await admin.from("players").select("wins").eq("player_id", state.winnerPlayerId).single();
      if (winner) {
        await admin.from("players").update({ wins: winner.wins + 1 }).eq("player_id", state.winnerPlayerId);
      }
    }

    return jsonResponse({ ownView: buildPrivatePlayerState(state, device.playerId) });
  } catch (err) {
    return errorResponse("SERVER_ERROR", String(err), 500);
  }
});
