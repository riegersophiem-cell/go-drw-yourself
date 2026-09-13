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
  it("counts both bonus cards when the acting player is also GIVE_TWO_TO_LOWEST's recipient", () => {
    // Reproduces a live bug: actor plays the LOWEST card (hand shrinks by 1),
    // then turns out to have the fewest cards and receives the 2 bonus cards
    // themselves - a plain after-minus-before delta reports a net +1 instead
    // of the 2 cards actually drawn, since the played card cancels one out.
    const base = game();
    const lowestDefId = Object.values(base.cardDefinitions).find((d) => d.type === "GIVE_TWO_TO_LOWEST")!.defId;
    const lowestInstanceId = Object.entries(base.cardInstanceRegistry).find(([, defId]) => defId === lowestDefId)![0];
    const handA = getHandOfPlayer(base, "a");
    const remainingPool = base.drawPile.filter((id) => id !== lowestInstanceId);
    const beforeHandA = { ...handA, cardInstanceIds: [lowestInstanceId, ...remainingPool.slice(0, 2)] }; // 3 cards
    const before: GameState = { ...base, hands: { ...base.hands, [handA.handId]: beforeHandA } };
    const drawnBonus = remainingPool.slice(2, 4);
    const afterHandA = { ...handA, cardInstanceIds: [...beforeHandA.cardInstanceIds.slice(1), ...drawnBonus] }; // -1 played +2 drawn = 4 cards
    const after: GameState = { ...before, hands: { ...before.hands, [handA.handId]: afterHandA }, version: before.version + 1 };
    const events = deriveGameActionEvents(before, after, "a", { type: "PLAY_CARD", cardInstanceId: lowestInstanceId });
    expect(events).toContainEqual(expect.objectContaining({ type: "DRAW", actorPlayerId: "a", payload: { playerId: "a", count: 2 } }));
  });
});
