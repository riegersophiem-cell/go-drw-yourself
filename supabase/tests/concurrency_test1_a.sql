-- Test 1, session A: holds the rooms row lock for 2s after committing its
-- write, so session B's concurrent call with the SAME actionId genuinely
-- blocks on it and only proceeds once A's applied_actions row is visible.
begin;
select public.apply_turn_batch(
  '50000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '53000000-0000-4000-8000-000000000000', 1, 1,
  '54000000-0000-4000-8000-000000000001',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000","version":2,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000"}',
  '[]', '[]', 'PLAYING', null, null) as a_result;
select pg_sleep(2);
commit;
