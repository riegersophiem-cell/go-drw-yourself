import { describe, expect, it } from "vitest";
import { parseMutationContext, writeMaintenanceEnabled } from "../supabase/functions/_shared/mutation";
const id="123e4567-e89b-42d3-a456-426614174000";
describe("mutation boundary",()=>{
  it("accepts start context only with null expected state",()=>expect(parseMutationContext({actionId:id,expectedGameId:null,expectedVersion:null},true)).toEqual({actionId:id,expectedGameId:null,expectedVersion:null}));
  it("requires all normal-action CAS fields",()=>expect(()=>parseMutationContext({actionId:id},false)).toThrow("MISSING_REQUIRED_FIELDS"));
  it("rejects malformed action ids",()=>expect(()=>parseMutationContext({actionId:"x",expectedGameId:null,expectedVersion:null},true)).toThrow("MISSING_REQUIRED_FIELDS"));
  it("rejects expected state on start",()=>expect(()=>parseMutationContext({actionId:id,expectedGameId:id,expectedVersion:1},true)).toThrow("INVALID_EXPECTED_STATE"));
  it("accepts a valid normal context",()=>expect(parseMutationContext({actionId:id,expectedGameId:id,expectedVersion:1},false).expectedVersion).toBe(1));
  it("enables maintenance only for literal true",()=>{expect(writeMaintenanceEnabled(()=>"true")).toBe(true);expect(writeMaintenanceEnabled(()=>"false")).toBe(false)});
});
