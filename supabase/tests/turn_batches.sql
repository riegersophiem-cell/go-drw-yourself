-- Integration suite for a local/non-production Supabase database.
-- Run after `supabase start` and migrations. Every fixture is rolled back.
begin;
do $$ begin
  if has_function_privilege('anon','public.apply_turn_batch(uuid,text,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid,uuid)','execute') then raise exception 'anon can execute apply_turn_batch'; end if;
  if has_function_privilege('authenticated','public.apply_turn_batch(uuid,text,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid,uuid)','execute') then raise exception 'authenticated can execute apply_turn_batch'; end if;
  if not has_function_privilege('service_role','public.apply_turn_batch(uuid,text,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid,uuid)','execute') then raise exception 'service_role cannot execute apply_turn_batch'; end if;
end $$;
do $$ begin
  if exists(select 1 from public.game_states where game_id is null) then raise exception 'missing game_id'; end if;
  if exists(select 1 from public.public_game_views where game_id is null) then raise exception 'missing public game_id'; end if;
  if exists(select 1 from public.private_player_views where game_id is null) then raise exception 'missing private game_id'; end if;
end $$;

insert into public.rooms(room_id,room_code,status) values
  ('10000000-0000-4000-8000-000000000001','T0B001','LOBBY'),
  ('10000000-0000-4000-8000-000000000002','T0B002','LOBBY');

-- START_GAME creates the missing snapshot and the structural 0 -> 1 batch.
select public.apply_turn_batch(
  '10000000-0000-4000-8000-000000000001','START_GAME',null,null,0,
  '20000000-0000-4000-8000-000000000001',
  '{"roomId":"10000000-0000-4000-8000-000000000001","gameId":"30000000-0000-4000-8000-000000000001","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"10000000-0000-4000-8000-000000000001","gameId":"30000000-0000-4000-8000-000000000001"}',
  '[]','[]','PLAYING',null,null);
do $$ begin
  if not exists(select 1 from public.game_event_batches where game_id='30000000-0000-4000-8000-000000000001' and from_version=0 and to_version=1) then raise exception 'missing 0 -> 1 batch'; end if;
end $$;

-- An identical actionId is a cached retry and does not apply twice.
select public.apply_turn_batch(
  '10000000-0000-4000-8000-000000000001','START_GAME',null,null,0,
  '20000000-0000-4000-8000-000000000001','{}','{}','{}','{}','LOBBY',null,null);

-- First normal transition coexists as 1 -> 2 under the same gameId.
select public.apply_turn_batch(
  '10000000-0000-4000-8000-000000000001','NORMAL_ACTION','30000000-0000-4000-8000-000000000001',1,1,
  '20000000-0000-4000-8000-000000000002',
  '{"roomId":"10000000-0000-4000-8000-000000000001","gameId":"30000000-0000-4000-8000-000000000001","version":2,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
  '{"roomId":"10000000-0000-4000-8000-000000000001","gameId":"30000000-0000-4000-8000-000000000001"}',
  '[]','[]','PLAYING',null,null);
do $$ begin
  if (select count(*) from public.game_event_batches where game_id='30000000-0000-4000-8000-000000000001') <> 2 then raise exception '0 -> 1 and 1 -> 2 did not coexist'; end if;
end $$;

-- Cross-room reuse of an actionId must fail with the specific invariant.
do $$ begin
  begin
    perform public.apply_turn_batch(
      '10000000-0000-4000-8000-000000000002','START_GAME',null,null,0,
      '20000000-0000-4000-8000-000000000001',
      '{"roomId":"10000000-0000-4000-8000-000000000002","gameId":"30000000-0000-4000-8000-000000000002","version":1,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
      '{"roomId":"10000000-0000-4000-8000-000000000002","gameId":"30000000-0000-4000-8000-000000000002"}','[]','[]','PLAYING',null,null);
    raise exception 'expected ACTION_ID_ROOM_MISMATCH';
  exception when others then
    if sqlerrm <> 'ACTION_ID_ROOM_MISMATCH' then raise; end if;
  end;
end $$;

-- A stale CAS must fail and leave version 2 intact.
do $$ begin
  begin
    perform public.apply_turn_batch(
      '10000000-0000-4000-8000-000000000001','NORMAL_ACTION','30000000-0000-4000-8000-000000000001',1,1,
      '20000000-0000-4000-8000-000000000003',
      '{"roomId":"10000000-0000-4000-8000-000000000001","gameId":"30000000-0000-4000-8000-000000000001","version":2,"phase":"WAITING_FOR_PLAY","winnerPlayerId":null}',
      '{"roomId":"10000000-0000-4000-8000-000000000001","gameId":"30000000-0000-4000-8000-000000000001"}','[]','[]','PLAYING',null,null);
    raise exception 'expected STALE_GAME_STATE';
  exception when others then if sqlerrm <> 'STALE_GAME_STATE' then raise; end if; end;
  if (select version from public.game_states where room_id='10000000-0000-4000-8000-000000000001') <> 2 then raise exception 'stale call changed state'; end if;
end $$;
rollback;
