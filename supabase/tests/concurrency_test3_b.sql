-- Test 3, session B: a second, concurrent first START_GAME for the SAME
-- still-empty room, fired ~0.5s after A while A holds the rooms row lock.
-- Must block, then -- once A has created the game_states row -- fail with
-- INVALID_TRANSITION_FOR_MISSING_STATE rather than creating a second game.
do $$
declare v_result jsonb;
begin
  v_result := public.apply_turn_batch(
    '50000000-0000-4000-8000-000000000001', 'START_GAME', null, null, 0,
    '54000000-0000-4000-8000-000000000005',
    '{"roomId":"50000000-0000-4000-8000-000000000001","gameId":"53000000-0000-4000-8000-000000000002","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
    '{"roomId":"50000000-0000-4000-8000-000000000001","gameId":"53000000-0000-4000-8000-000000000002"}',
    '[]', '[]', 'PLAYING', null, null);
  raise notice 'B_UNEXPECTED_SUCCESS: %', v_result;
exception when others then
  raise notice 'B_ERROR: %', sqlerrm;
end $$;
