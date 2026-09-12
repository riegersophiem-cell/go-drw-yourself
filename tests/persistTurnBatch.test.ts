import { describe, expect, it } from "vitest";
import { createNewGame } from "../src/game/gameState";
import { persistTurnBatch } from "../supabase/functions/_shared/persist";

describe("persistTurnBatch",()=>{
  it("commits the complete batch before broadcasting the same metadata",async()=>{
    const calls:string[]=[]; let rpcArgs:Record<string,unknown>|undefined; let broadcast:Record<string,unknown>|undefined;
    const admin={
      rpc:async(_name:string,args:Record<string,unknown>)=>{calls.push("rpc");rpcArgs=args;return{data:{ok:true},error:null}},
      channel:()=>({send:async(message:Record<string,unknown>)=>{calls.push("broadcast");broadcast=message;return{status:"ok"}}}),
    };
    const state=createNewGame("room",[{playerId:"p1",displayName:"A",type:"HUMAN"},{playerId:"p2",displayName:"B",type:"BOT"}],undefined,()=>0.4);
    const events=[{sequence:0,actorPlayerId:"p2",type:"DRAW" as const,payload:{playerId:"p2",count:1},resultVersion:2}];
    const result=await persistTurnBatch(admin as never,{...state,version:2},{transitionMode:"START_GAME",expectedGameId:null,expectedVersion:null,batchFromVersion:0,actionId:"action",roomStatus:"PLAYING",events});
    expect(calls).toEqual(["rpc","broadcast"]);
    expect(rpcArgs?.p_events).toEqual(events);
    expect(rpcArgs?.p_private_views).toEqual([expect.objectContaining({player_id:"p1"})]);
    expect(broadcast).toEqual({type:"broadcast",event:"state_changed",payload:result.batch});
    expect(result.batch).toEqual({gameId:state.gameId,batchId:"action",fromVersion:0,toVersion:2,events});
  });

  it("does not broadcast when the transaction fails",async()=>{
    let sent=false;
    const admin={rpc:async()=>({data:null,error:new Error("STALE_GAME_STATE")}),channel:()=>({send:async()=>{sent=true}})};
    const state=createNewGame("room",[{playerId:"p1",displayName:"A",type:"HUMAN"},{playerId:"p2",displayName:"B",type:"BOT"}],undefined,()=>0.4);
    await expect(persistTurnBatch(admin as never,state,{transitionMode:"NORMAL_ACTION",expectedGameId:state.gameId,expectedVersion:1,batchFromVersion:1,actionId:"action",roomStatus:"PLAYING"})).rejects.toThrow("STALE_GAME_STATE");
    expect(sent).toBe(false);
  });
});
