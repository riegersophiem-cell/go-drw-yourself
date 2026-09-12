import { authenticateDevice } from "../_shared/auth.ts";
import { parseMutationContext, writeMaintenanceEnabled } from "../_shared/mutation.ts";
import { loadGameState, persistTurnBatch } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { runBotTurnsUntilHumanOrOver } from "../_shared/botLoop.ts";
Deno.serve(async(req)=>{ if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders()});
  if(writeMaintenanceEnabled()) return errorResponse("MAINTENANCE","Spielaktionen sind kurz pausiert. Bitte versuche es gleich erneut.",503);
  try { const body=await req.json() as Record<string,unknown>&{deviceId:string;sessionToken:string;targetPlayerId:string}; const context=parseMutationContext(body,false); const admin=supabaseAdmin(); const device=await authenticateDevice(admin,body.deviceId,body.sessionToken);
    const {data:room}=await admin.from("rooms").select("*").eq("room_id",device.roomId).single(); if(room.host_device_id!==device.deviceId) return errorResponse("NOT_HOST","Nur der Host kann dies tun.",403);
    if(room.status!=="PLAYING") return errorResponse("ROOM_NOT_PLAYING","Das Spiel läuft nicht.",409);
    let state=await loadGameState(admin,device.roomId);
    state={...state,version:state.version+1,players:state.players.map((p)=>p.playerId===body.targetPlayerId?{...p,type:"BOT" as const,botStrategyLevel:"NORMAL" as const}:p)};
    const botResult=await runBotTurnsUntilHumanOrOver(admin,state); state=botResult.state; const roomStatus=state.phase==="GAME_OVER"?"FINISHED":"PLAYING";
    const persisted=await persistTurnBatch(admin,state,{transitionMode:"NORMAL_ACTION",expectedGameId:context.expectedGameId,expectedVersion:context.expectedVersion,batchFromVersion:context.expectedVersion!,actionId:context.actionId,roomStatus,winnerPlayerId:state.winnerPlayerId,replacedPlayerId:body.targetPlayerId,events:botResult.events});
    return jsonResponse({ok:true,batch:persisted.batch,gameId:state.gameId,version:state.version});
  } catch(err){ const code=err instanceof Error?err.message:"SERVER_ERROR"; if(code==="MISSING_REQUIRED_FIELDS") return errorResponse(code,"Bitte lade die Seite neu.",400); if(String(err).includes("STALE_GAME_STATE")||String(err).includes("GAME_CHANGED")) return errorResponse("STALE_GAME_STATE","Der Spielstand hat sich geändert.",409); return errorResponse("SERVER_ERROR",String(err),500); }
});
