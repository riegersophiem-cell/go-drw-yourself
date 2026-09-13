import { sequenceEvents } from "../../../src/game/gameEventDerivation.ts";
import type { PendingGameEvent } from "../../../src/game/gameEvents.ts";
import { forfeitPlayer } from "../../../src/game/playerDeparture.ts";
import { toPublicGameState } from "../../../src/game/gameState.ts";
import { buildPrivatePlayerState } from "../../../src/game/projections.ts";
import { authenticateDevice } from "../_shared/auth.ts";
import { runBotTurnsUntilHumanOrOver } from "../_shared/botLoop.ts";
import { parseMutationContext, writeMaintenanceEnabled } from "../_shared/mutation.ts";
import { loadGameState } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

type DepartureMode = "LEAVE" | "REMOVE";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders() });
  if (writeMaintenanceEnabled()) return errorResponse("MAINTENANCE", "Spielaktionen sind kurz pausiert. Bitte versuche es gleich erneut.", 503);

  try {
    const body = await req.json() as Record<string, unknown> & { deviceId: string; sessionToken: string; mode?: DepartureMode; targetPlayerId?: string };
    const admin = supabaseAdmin();
    const device = await authenticateDevice(admin, body.deviceId, body.sessionToken);
    const { data: room, error: roomError } = await admin.from("rooms").select("*").eq("room_id", device.roomId).single();
    if (roomError || !room) throw roomError ?? new Error("ROOM_NOT_FOUND");

    const mode: DepartureMode = body.mode === "REMOVE" ? "REMOVE" : "LEAVE";
    const targetPlayerId = mode === "LEAVE" ? device.playerId : body.targetPlayerId;
    if (!targetPlayerId) return errorResponse("NOT_A_PLAYER", "Nur Spieler können das Spiel verlassen.", 403);
    if (mode === "REMOVE" && (room.host_device_id !== device.deviceId || targetPlayerId === device.playerId)) {
      return errorResponse("NOT_HOST", "Nur der Host kann andere Spieler entfernen.", 403);
    }

    if (room.status === "LOBBY") {
      const { data, error } = await admin.rpc("remove_lobby_player", {
        p_room_id: device.roomId,
        p_actor_device_id: device.deviceId,
        p_target_player_id: targetPlayerId,
      });
      if (error) throw error;
      return jsonResponse(data ?? { ok: true });
    }

    if (room.status !== "PLAYING") {
      // The room can legitimately already be FINISHED because a prior,
      // successful call to this same action was the one that ended the game
      // and the client never saw that response (dropped connection, etc).
      // apply_player_departure/apply_turn_batch already cache by actionId,
      // but that cache is only reached if we call the RPC at all - without
      // this check, a retry of the game-ending departure permanently fails
      // with ROOM_NOT_PLAYING instead of returning the stored result.
      const actionId = typeof body.actionId === "string" ? body.actionId : null;
      if (actionId) {
        const { data: cached } = await admin.from("applied_actions").select("response").eq("action_id", actionId).eq("room_id", device.roomId).maybeSingle();
        if (cached) return jsonResponse(cached.response);
      }
      return errorResponse("ROOM_NOT_PLAYING", "Diese Runde läuft nicht mehr.", 409);
    }
    const context = parseMutationContext(body, false);
    const { data: target, error: targetError } = await admin.from("players").select("player_id,device_id,display_name").eq("room_id", device.roomId).eq("player_id", targetPlayerId).single();
    if (targetError || !target) return errorResponse("PLAYER_NOT_FOUND", "Dieser Spieler ist nicht mehr im Raum.", 404);

    let state = await loadGameState(admin, device.roomId);
    state = forfeitPlayer(state, targetPlayerId);
    const departureEvent: PendingGameEvent = {
      sequence: 0,
      actorPlayerId: targetPlayerId,
      type: "PLAYER_ELIMINATED",
      payload: { playerId: targetPlayerId, reason: mode === "LEAVE" ? "LEFT" : "REMOVED" },
      resultVersion: state.version,
    };
    const initialEvents: PendingGameEvent[] = [departureEvent];
    if (state.phase === "GAME_OVER" && state.winnerPlayerId) {
      initialEvents.push({ sequence: 1, actorPlayerId: state.winnerPlayerId, type: "GAME_OVER", payload: { winnerPlayerId: state.winnerPlayerId }, resultVersion: state.version });
    }

    const botResult = await runBotTurnsUntilHumanOrOver(admin, state);
    state = botResult.state;
    const events = sequenceEvents([...initialEvents, ...botResult.events].map(({ sequence: _sequence, ...event }) => event));
    const roomStatus = state.phase === "GAME_OVER" ? "FINISHED" : "PLAYING";
    const publicView = toPublicGameState(state, roomStatus);
    const privateViews = state.players.filter((player) => player.type === "HUMAN" && !player.eliminated && player.connected).map((player) => ({
      player_id: player.playerId,
      view: buildPrivatePlayerState(state, player.playerId),
    }));

    let newHostDeviceId: string | null = null;
    if (room.host_device_id === target.device_id) {
      const { data: candidates, error: candidatesError } = await admin.from("players")
        .select("player_id,device_id,seat_index")
        .eq("room_id", device.roomId)
        .eq("player_type", "HUMAN")
        .eq("connected", true)
        .neq("player_id", targetPlayerId)
        .order("seat_index", { ascending: true })
        .limit(1);
      if (candidatesError) throw candidatesError;
      newHostDeviceId = candidates?.[0]?.device_id ?? null;
    }

    const { data, error } = await admin.rpc("apply_player_departure", {
      p_room_id: device.roomId,
      p_actor_device_id: device.deviceId,
      p_target_player_id: targetPlayerId,
      p_departure_reason: mode === "LEAVE" ? "LEFT" : "REMOVED",
      p_new_host_device_id: newHostDeviceId,
      p_expected_game_id: context.expectedGameId,
      p_expected_version: context.expectedVersion,
      p_batch_from_version: context.expectedVersion,
      p_action_id: context.actionId,
      p_new_state: state,
      p_public_view: publicView,
      p_private_views: privateViews,
      p_events: events,
      p_room_status: roomStatus,
      p_winner_player_id: state.winnerPlayerId,
    });
    if (error) throw error;

    const batch = { batchId: context.actionId, roomId: device.roomId, gameId: state.gameId, fromVersion: context.expectedVersion!, toVersion: state.version, events };
    await admin.channel(`room:${device.roomId}:public`).send({ type: "broadcast", event: "state_changed", payload: batch });
    return jsonResponse({ ...(data as Record<string, unknown>), batch, gameId: state.gameId, version: state.version });
  } catch (err) {
    // remove_lobby_player/apply_player_departure raise plain Postgres
    // exceptions, which the Supabase client surfaces as a PostgrestError
    // object (not an Error instance). `err instanceof Error` missed those,
    // so every RPC-raised business error (already-removed player, race
    // between two removals, etc) fell through to String(err) === "[object
    // Object]" - a 500 with an unreadable message instead of the specific
    // outcome. Reproduced live: removing an already-departed player twice.
    const code = err instanceof Error ? err.message
      : typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string" ? (err as { message: string }).message
      : "SERVER_ERROR";
    if (code === "MISSING_REQUIRED_FIELDS") return errorResponse(code, "Bitte lade die Seite neu.", 400);
    if (code.includes("STALE_GAME_STATE") || code.includes("GAME_CHANGED")) return errorResponse("STALE_GAME_STATE", "Der Spielstand hat sich geändert.", 409);
    if (code === "PLAYER_NOT_FOUND" || code === "PLAYER_NOT_ACTIVE") return errorResponse(code, "Dieser Spieler ist nicht mehr im Raum.", 404);
    if (code === "NOT_HOST") return errorResponse(code, "Nur der Host kann andere Spieler entfernen.", 403);
    if (code === "ROOM_NOT_IN_LOBBY" || code === "ROOM_NOT_PLAYING") return errorResponse(code, "Diese Runde läuft nicht mehr.", 409);
    return errorResponse("SERVER_ERROR", code, 500);
  }
});
