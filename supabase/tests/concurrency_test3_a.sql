-- Test 3, session A: first START_GAME for a room with no game_states row
-- yet, holds the lock for 2s after committing its INSERT.
begin;
select public.apply_turn_batch(
  '50000000-0000-4000-8000-000000000001', 'START_GAME', null, null, 0,
  '54000000-0000-4000-8000-000000000004',
  '{"roomId":"50000000-0000-4000-8000-000000000001","gameId":"53000000-0000-4000-8000-000000000001","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"50000000-0000-4000-8000-000000000001","gameId":"53000000-0000-4000-8000-000000000001"}',
  '[]', '[]', 'PLAYING', null, null) as a_result;
select pg_sleep(2);
commit;
