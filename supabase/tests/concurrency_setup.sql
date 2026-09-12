-- Fixture for the true-concurrency tests (two real, separate connections).
-- Not wrapped in a transaction: the rows must be visible to two independent
-- sessions. Cleaned up by concurrency_cleanup.sql afterwards.
insert into public.rooms(room_id, room_code, status) values
  ('50000000-0000-4000-8000-000000000001', 'CONC01', 'LOBBY'),
  ('50000000-0000-4000-8000-000000000002', 'CONC02', 'LOBBY');

-- Room 2 already has a started game at version 1, as the baseline for the
-- identical-actionId and different-actionId races (both act on an existing
-- NORMAL_ACTION transition rather than START_GAME's missing-row case).
select public.apply_turn_batch(
  '50000000-0000-4000-8000-000000000002', 'START_GAME', null, null, 0,
  '52000000-0000-4000-8000-000000000000',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000"}',
  '[]', '[]', 'PLAYING', null, null);
