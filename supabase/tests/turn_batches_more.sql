-- Extends turn_batches.sql with the scenarios from BOT_TURN_ARCHITECTURE.md
-- §14 that the original smoke suite did not yet cover: NEXT_ROUND producing
-- a 0->N batch that ends the round immediately (bot-win-after-next-round),
-- an immediate bot win right after START_GAME, a rejected [-1,1] event
-- sequence, a foreign/mismatched winner, and replace-with-bot's private-view
-- deletion. Run after turn_batches.sql, or standalone after migrations.
-- Every fixture is rolled back.
begin;

-- ---------------------------------------------------------------------
-- Room A: a full round that finishes normally, then NEXT_ROUND finishes
-- immediately too (0 -> 3 batch, two events, winner on the very next call).
-- ---------------------------------------------------------------------
insert into public.rooms(room_id, room_code, status) values
  ('40000000-0000-4000-8000-000000000001', 'EXTA01', 'LOBBY');
insert into public.players(player_id, room_id, display_name, player_type, seat_index) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'A1', 'HUMAN', 0),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'A2', 'HUMAN', 1);

select public.apply_turn_batch(
  '40000000-0000-4000-8000-000000000001', 'START_GAME', null, null, 0,
  '42000000-0000-4000-8000-000000000001',
  '{"roomId":"40000000-0000-4000-8000-000000000001","gameId":"43000000-0000-4000-8000-000000000001","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"40000000-0000-4000-8000-000000000001","gameId":"43000000-0000-4000-8000-000000000001"}',
  '[]', '[]', 'PLAYING', null, null);

-- Round 1 ends normally: version 1 -> 2, A1 wins.
select public.apply_turn_batch(
  '40000000-0000-4000-8000-000000000001', 'NORMAL_ACTION', '43000000-0000-4000-8000-000000000001', 1, 1,
  '42000000-0000-4000-8000-000000000002',
  '{"roomId":"40000000-0000-4000-8000-000000000001","gameId":"43000000-0000-4000-8000-000000000001","version":2,"phase":"GAME_OVER","winnerPlayerId":"41000000-0000-4000-8000-000000000001"}',
  '{"roomId":"40000000-0000-4000-8000-000000000001","gameId":"43000000-0000-4000-8000-000000000001"}',
  '[]',
  '[{"sequence":0,"actorPlayerId":null,"type":"GAME_OVER","payload":{"winnerPlayerId":"41000000-0000-4000-8000-000000000001"},"resultVersion":2}]',
  'FINISHED', '41000000-0000-4000-8000-000000000001', null);
do $$ begin
  if (select wins from public.players where player_id = '41000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'A1 should have exactly one win after round 1';
  end if;
end $$;

-- NEXT_ROUND: new gameId, and this round's own immediate bot chain already
-- ends it (version 1 -> 3, two events, A2 wins) -- the 0 -> N batch case.
select public.apply_turn_batch(
  '40000000-0000-4000-8000-000000000001', 'NEXT_ROUND', '43000000-0000-4000-8000-000000000001', 2, 0,
  '42000000-0000-4000-8000-000000000003',
  '{"roomId":"40000000-0000-4000-8000-000000000001","gameId":"43000000-0000-4000-8000-000000000002","version":3,"phase":"GAME_OVER","winnerPlayerId":"41000000-0000-4000-8000-000000000002"}',
  '{"roomId":"40000000-0000-4000-8000-000000000001","gameId":"43000000-0000-4000-8000-000000000002"}',
  '[]',
  '[{"sequence":0,"actorPlayerId":"41000000-0000-4000-8000-000000000002","type":"DRAW","payload":{"playerId":"41000000-0000-4000-8000-000000000002","count":1},"resultVersion":2},
    {"sequence":1,"actorPlayerId":null,"type":"GAME_OVER","payload":{"winnerPlayerId":"41000000-0000-4000-8000-000000000002"},"resultVersion":3}]',
  'FINISHED', '41000000-0000-4000-8000-000000000002', null);
do $$ begin
  if not exists(
    select 1 from public.game_event_batches
    where game_id = '43000000-0000-4000-8000-000000000002' and from_version = 0 and to_version = 3
  ) then raise exception 'missing 0 -> 3 batch for the new round'; end if;
  if (select wins from public.players where player_id = '41000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'A2 should have exactly one win after the immediate next-round finish';
  end if;
  -- Both rounds'' batches coexist without a (game_id, from_version) collision.
  if (select count(*) from public.game_event_batches where room_id = '40000000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'expected exactly 3 coexisting batches (0->1, 1->2, 0->3) across both rounds';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Room C: immediate bot win right after START_GAME itself (no prior round).
-- ---------------------------------------------------------------------
insert into public.rooms(room_id, room_code, status) values
  ('40000000-0000-4000-8000-000000000003', 'EXTC01', 'LOBBY');
insert into public.players(player_id, room_id, display_name, player_type, seat_index) values
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000003', 'C1', 'HUMAN', 0);

select public.apply_turn_batch(
  '40000000-0000-4000-8000-000000000003', 'START_GAME', null, null, 0,
  '42000000-0000-4000-8000-000000000005',
  '{"roomId":"40000000-0000-4000-8000-000000000003","gameId":"43000000-0000-4000-8000-000000000005","version":2,"phase":"GAME_OVER","winnerPlayerId":"41000000-0000-4000-8000-000000000005"}',
  '{"roomId":"40000000-0000-4000-8000-000000000003","gameId":"43000000-0000-4000-8000-000000000005"}',
  '[]',
  '[{"sequence":0,"actorPlayerId":null,"type":"GAME_OVER","payload":{"winnerPlayerId":"41000000-0000-4000-8000-000000000005"},"resultVersion":2}]',
  'FINISHED', '41000000-0000-4000-8000-000000000005', null);
do $$ begin
  if (select status from public.rooms where room_id = '40000000-0000-4000-8000-000000000003') <> 'FINISHED' then
    raise exception 'room should reach FINISHED directly out of START_GAME';
  end if;
  if (select wins from public.players where player_id = '41000000-0000-4000-8000-000000000005') <> 1 then
    raise exception 'C1 should have won immediately after start-game';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Room B: validation-only scenarios (event sequence, winner, private views).
-- ---------------------------------------------------------------------
insert into public.rooms(room_id, room_code, status) values
  ('40000000-0000-4000-8000-000000000002', 'EXTB01', 'LOBBY');
insert into public.players(player_id, room_id, display_name, player_type, seat_index) values
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'B1', 'HUMAN', 0),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', 'B2', 'HUMAN', 1);

select public.apply_turn_batch(
  '40000000-0000-4000-8000-000000000002', 'START_GAME', null, null, 0,
  '42000000-0000-4000-8000-000000000004',
  '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}',
  ('[{"player_id":"41000000-0000-4000-8000-000000000003","view":{"playerId":"41000000-0000-4000-8000-000000000003","publicState":{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}}},'
 || '{"player_id":"41000000-0000-4000-8000-000000000004","view":{"playerId":"41000000-0000-4000-8000-000000000004","publicState":{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}}}]')::jsonb,
  '[]', 'PLAYING', null, null);
do $$ begin
  if (select count(*) from public.private_player_views where room_id = '40000000-0000-4000-8000-000000000002') <> 2 then
    raise exception 'expected 2 private views right after start-game';
  end if;
end $$;

-- Rejected: sequence [-1, 1] is neither contiguous nor zero-based.
do $$ begin
  begin
    perform public.apply_turn_batch(
      '40000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '43000000-0000-4000-8000-000000000003', 1, 1,
      '42000000-0000-4000-8000-000000000006',
      '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003","version":2,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
      '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}',
      '[]',
      '[{"sequence":-1,"actorPlayerId":"41000000-0000-4000-8000-000000000003","type":"DRAW","payload":{"playerId":"41000000-0000-4000-8000-000000000003","count":1},"resultVersion":2},
        {"sequence":1,"actorPlayerId":"41000000-0000-4000-8000-000000000003","type":"DRAW","payload":{"playerId":"41000000-0000-4000-8000-000000000003","count":1},"resultVersion":2}]',
      'PLAYING', null, null);
    raise exception 'expected EVENT_SEQUENCE_NOT_CONTIGUOUS';
  exception when others then
    if sqlerrm <> 'EVENT_SEQUENCE_NOT_CONTIGUOUS' then raise; end if;
  end;
  if (select version from public.game_states where room_id = '40000000-0000-4000-8000-000000000002') <> 1 then
    raise exception 'rejected event sequence must not have changed the version';
  end if;
end $$;

-- Rejected: winner belongs to a different room entirely.
do $$ begin
  begin
    perform public.apply_turn_batch(
      '40000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '43000000-0000-4000-8000-000000000003', 1, 1,
      '42000000-0000-4000-8000-000000000007',
      '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003","version":2,"phase":"GAME_OVER","winnerPlayerId":"41000000-0000-4000-8000-000000000001"}',
      '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}',
      '[]', '[]', 'FINISHED', '41000000-0000-4000-8000-000000000001', null);
    raise exception 'expected WINNER_NOT_IN_ROOM';
  exception when others then
    if sqlerrm <> 'WINNER_NOT_IN_ROOM' then raise; end if;
  end;
end $$;

-- Rejected: p_winner_player_id disagrees with p_new_state.winnerPlayerId.
do $$ begin
  begin
    perform public.apply_turn_batch(
      '40000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '43000000-0000-4000-8000-000000000003', 1, 1,
      '42000000-0000-4000-8000-000000000008',
      '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003","version":2,"phase":"GAME_OVER","winnerPlayerId":"41000000-0000-4000-8000-000000000004"}',
      '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}',
      '[]', '[]', 'FINISHED', '41000000-0000-4000-8000-000000000003', null);
    raise exception 'expected WINNER_MISMATCH';
  exception when others then
    if sqlerrm <> 'WINNER_MISMATCH' then raise; end if;
  end;
  if (select status from public.rooms where room_id = '40000000-0000-4000-8000-000000000002') <> 'PLAYING' then
    raise exception 'rejected winner mismatch must not have changed room status';
  end if;
end $$;

-- replace-with-bot: B2's private view must be deleted, B1's must remain.
select public.apply_turn_batch(
  '40000000-0000-4000-8000-000000000002', 'NORMAL_ACTION', '43000000-0000-4000-8000-000000000003', 1, 1,
  '42000000-0000-4000-8000-000000000009',
  '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003","version":2,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}',
  ('[{"player_id":"41000000-0000-4000-8000-000000000003","view":{"playerId":"41000000-0000-4000-8000-000000000003","publicState":{"roomId":"40000000-0000-4000-8000-000000000002","gameId":"43000000-0000-4000-8000-000000000003"}}}]')::jsonb,
  '[]', 'PLAYING', null, '41000000-0000-4000-8000-000000000004');
do $$ begin
  if exists(select 1 from public.private_player_views where player_id = '41000000-0000-4000-8000-000000000004') then
    raise exception 'B2''s private view should have been deleted by replace-with-bot';
  end if;
  if not exists(select 1 from public.private_player_views where player_id = '41000000-0000-4000-8000-000000000003') then
    raise exception 'B1''s private view should still exist';
  end if;
  if (select player_type from public.players where player_id = '41000000-0000-4000-8000-000000000004') <> 'BOT' then
    raise exception 'B2 should have been converted to a BOT';
  end if;
end $$;

rollback;
