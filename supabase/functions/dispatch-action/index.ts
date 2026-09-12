import { dispatchGameAction, type GameAction } from "../../../src/game/actions.ts";
import { buildPrivatePlayerState } from "../../../src/game/projections.ts";
import { deriveGameActionEvents, sequenceEvents } from "../../../src/game/gameEventDerivation.ts";
import { GameError } from "../../../src/game/errors.ts";
import { authenticateDevice } from "../_shared/auth.ts";
import { parseMutationContext, writeMaintenanceEnabled } from "../_shared/mutation.ts";
import { loadGameState, persistTurnBatch } from "../_shared/persist.ts";
import { corsHeaders, errorResponse, jsonResponse, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { runBotTurnsUntilHumanOrOver } from "../_shared/botLoop.ts";
Deno.serve(async(req)=>{ if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders()});
  if(writeMaintenanceEnabled()) return errorResponse("MAINTENANCE","Spielaktionen sind kurz pausiert. Bitte versuche es gleich erneut.",503);
  try { const body=await req.json() as Record<string,unknown>&{deviceId:string;sessionToken:string;action:GameAction}; const context=parseMutationContext(body,false); const admin=supabaseAdmin(); const device=await authenticateDevice(admin,body.deviceId,body.sessionToken);
    if(device.role!=="PLAYER"||!device.playerId) return errorResponse("NOT_A_PLAYER","Nur Spieler-Geräte können Spielzüge senden.",403);
    let state=await loadGameState(admin,device.roomId); const beforeHumanAction=state;
    try { state=dispatchGameAction(state,device.playerId,{...body.action,expectedVersion:context.expectedVersion??undefined}); } catch(e){ if(e instanceof GameError) return errorResponse(e.code,e.message,409); throw e; }
    // Target-selection rules currently do not increment their version themselves.
    // Every committed NORMAL_ACTION still needs one monotonic CAS result version.
    if(state.version===context.expectedVersion) state={...state,version:state.version+1};
    const humanEvents=sequenceEvents(deriveGameActionEvents(beforeHumanAction,state,device.playerId,body.action));
    const botResult=await runBotTurnsUntilHumanOrOver(admin,state); state=botResult.state;
    const events=[...humanEvents,...botResult.events.map((event,index)=>({...event,sequence:humanEvents.length+index}))]; const roomStatus=state.phase==="GAME_OVER"?"FINISHED":"PLAYING";
    const persisted=await persistTurnBatch(admin,state,{transitionMode:"NORMAL_ACTION",expectedGameId:context.expectedGameId,expectedVersion:context.expectedVersion,batchFromVersion:context.expectedVersion!,actionId:context.actionId,roomStatus,winnerPlayerId:state.winnerPlayerId,events});
    return jsonResponse({ownView:buildPrivatePlayerState(state,device.playerId),batch:persisted.batch,gameId:state.gameId,version:state.version});
  } catch(err){ const code=err instanceof Error?err.message:"SERVER_ERROR"; if(code==="MISSING_REQUIRED_FIELDS") return errorResponse(code,"Bitte lade die Seite neu.",400); if(String(err).includes("STALE_GAME_STATE")||String(err).includes("GAME_CHANGED")) return errorResponse("STALE_GAME_STATE","Der Spielstand hat sich geändert.",409); return errorResponse("SERVER_ERROR",String(err),500); }
});
