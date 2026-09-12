-- Test 2, session B: different actionId, same expected_version=2, fired
-- ~0.5s after A while A still holds the lock. Must block, then -- once A
-- has committed and moved the room to version 3 -- fail with
-- STALE_GAME_STATE rather than silently overwriting A's write.
do $$
declare v_result jsonb;
begin
  v_result := public.apply_turn_batch(
    '50000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '53000000-0000-4000-8000-000000000000', 2, 2,
    '54000000-0000-4000-8000-000000000003',
    '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000","version":3,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null,"marker":"B"}',
    '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000"}',
    '[]', '[]', 'PLAYING', null, null);
  raise notice 'B_UNEXPECTED_SUCCESS: %', v_result;
exception when others then
  raise notice 'B_ERROR: %', sqlerrm;
end $$;
