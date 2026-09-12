import { describe, expect, it } from "vitest";
import { runBotTurnsUntilHumanOrOver } from "../supabase/functions/_shared/botLoop";
import { createNewGame, definitionOfInstance, getPlayer } from "../src/game/gameState";
import type { GameState } from "../src/game/types";

const rng=()=>0.33;
function botGame(types:("BOT"|"HUMAN")[]):GameState {
  const state=createNewGame("room",types.map((type,index)=>({playerId:`p${index}`,displayName:`P${index}`,type})),undefined,rng);
  return {...state,players:state.players.map((p)=>({...p,botStrategyLevel:p.type==="BOT"?"NORMAL":undefined}))};
}

describe("bot turn batches",()=>{
  for(const count of [1,2,4,7]) it(`runs ${count} bot turn(s) without server delays and returns a contiguous batch`,async()=>{
    const state=botGame([...Array.from({length:count},()=>"BOT" as const),"HUMAN"]);
    const started=Date.now();
    const result=await runBotTurnsUntilHumanOrOver(null as never,state,{chooseAction:()=>({type:"DRAW"})});
    expect(Date.now()-started).toBeLessThan(200);
    expect(result.state.currentPlayerId).toBe(`p${count}`);
    expect(result.events.map((e)=>e.sequence)).toEqual(Array.from({length:count},(_,index)=>index));
    expect(result.events.every((e)=>e.type==="DRAW")).toBe(true);
    expect(JSON.stringify(result.events)).not.toContain("instanceId");
  });

  it("emits a play event using only the public card definition",async()=>{
    let state=botGame(["BOT","HUMAN"]);
    const player=getPlayer(state,"p0");
    const instanceId=Object.keys(state.cardInstanceRegistry).find((id)=>{
      const def=definitionOfInstance(state,id); return def.color===state.activeColor&&def.type==="TRIANGLE";
    })!;
    state={...state,drawPile:state.drawPile.filter((id)=>id!==instanceId),hands:Object.fromEntries(Object.entries(state.hands).map(([id,hand])=>[id,{...hand,cardInstanceIds:hand.cardInstanceIds.filter((card)=>card!==instanceId)}]))};
    const hand=state.hands[player.currentHandId]; state={...state,hands:{...state.hands,[hand.handId]:{...hand,cardInstanceIds:[instanceId,...hand.cardInstanceIds]}}};
    const result=await runBotTurnsUntilHumanOrOver(null as never,state,{chooseAction:()=>({type:"PLAY_CARD",instanceId,chosenColor:definitionOfInstance(state,instanceId).color==="WILD"?"RED":undefined})});
    const play=result.events.find((e)=>e.type==="PLAY_CARD");
    expect(play?.payload).toEqual(expect.objectContaining({playerId:"p0",color:definitionOfInstance(state,instanceId).color,cardType:definitionOfInstance(state,instanceId).type}));
    expect(JSON.stringify(play)).not.toContain(instanceId);
  });

  it("throws instead of persisting a partial chain when its guard is reached",async()=>{
    const state=botGame(["BOT","BOT"]);
    await expect(runBotTurnsUntilHumanOrOver(null as never,state,{maxSteps:1,chooseAction:()=>({type:"DRAW"})})).rejects.toThrow("BOT_TURN_GUARD_EXCEEDED");
  });
});
