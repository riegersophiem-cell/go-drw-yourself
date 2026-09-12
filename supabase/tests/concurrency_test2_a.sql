-- Test 2, session A: distinct actionId, holds the lock for 2s after its own
-- write (room 2 is now at version 2 after test 1) so session B's
-- concurrent, DIFFERENT actionId with the SAME expected_version=2 genuinely
-- races against it rather than merely running sequentially.
begin;
select public.apply_turn_batch(
  '50000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '53000000-0000-4000-8000-000000000000', 2, 2,
  '54000000-0000-4000-8000-000000000002',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000","version":3,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null,"marker":"A"}',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000"}',
  '[]', '[]', 'PLAYING', null, null) as a_result;
select pg_sleep(2);
commit;
