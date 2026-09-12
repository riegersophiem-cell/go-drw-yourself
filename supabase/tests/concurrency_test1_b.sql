-- Test 1, session B: identical actionId to session A, fired ~0.5s later
-- while A still holds the rooms row lock inside its open transaction. Must
-- block, then return A's cached response verbatim -- never STALE_GAME_STATE.
select public.apply_turn_batch(
  '50000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '53000000-0000-4000-8000-000000000000', 1, 1,
  '54000000-0000-4000-8000-000000000001',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000","version":2,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"50000000-0000-4000-8000-000000000002","gameId":"53000000-0000-4000-8000-000000000000"}',
  '[]', '[]', 'PLAYING', null, null) as b_result;
