import { describe, expect, it } from "vitest";
import { deriveGameActionEvents, sequenceEvents } from "../src/game/gameEventDerivation";
import { createNewGame, getHandOfPlayer } from "../src/game/gameState";
import { drawFromStackOrDeck } from "../src/game/rulesEngine";
import type { GameState } from "../src/game/types";

const rng = () => 0.25;
function game(): GameState { return createNewGame("room", [{playerId:"a",displayName:"A",type:"BOT"},{playerId:"b",displayName:"B",type:"HUMAN"}], undefined, rng); }

describe("game event derivation", () => {
  it("describes a normal draw without exposing card ids", () => {
    const before=game(); const after=drawFromStackOrDeck(before,"a",undefined,rng);
    const events=sequenceEvents(deriveGameActionEvents(before,after,"a",{type:"DRAW_CARD"}));
    expect(events).toEqual([expect.objectContaining({sequence:0,type:"DRAW",payload:{playerId:"a",count:1},resultVersion:2})]);
    expect(JSON.stringify(events)).not.toContain(getHandOfPlayer(after,"a").cardInstanceIds.at(-1));
  });
  it("describes a draw-stack resolution with the public total", () => {
    const base=game(); const before={...base,pendingEffect:{type:"DRAW_STACK" as const,amount:4,sourcePlayerId:"b",allowedResponseDefIds:[]}};
    const after=drawFromStackOrDeck(before,"a",undefined,rng);
    expect(deriveGameActionEvents(before,after,"a",{type:"DRAW_CARD"})[0]).toEqual(expect.objectContaining({type:"DRAW_STACK_RESOLVED",payload:{playerId:"a",amount:4}}));
  });
  it("keeps target selection events ordered even at the same result version", () => {
    const before=game(); const after={...before,version:2};
    const events=sequenceEvents(deriveGameActionEvents(before,after,"a",{type:"CHOOSE_SWAP_TARGET",targetPlayerId:"b"}),3);
    expect(events.map((e)=>[e.sequence,e.type,e.resultVersion])).toEqual([[3,"CHOSE_SWAP_TARGET",2],[4,"HANDS_SWAPPED",2]]);
  });
});
