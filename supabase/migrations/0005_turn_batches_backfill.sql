-- Phase 5 / Paket 0B, Schritt 1: additive schema, backfill and atomic write RPC.
-- Apply only inside the documented write-maintenance window.

alter table public.game_states add column if not exists game_id uuid;
alter table public.public_game_views add column if not exists game_id uuid;
alter table public.private_player_views add column if not exists game_id uuid;
alter table public.game_events add column if not exists game_id uuid;
alter table public.game_events add column if not exists legacy boolean not null default false;
alter table public.game_events add column if not exists batch_id uuid;
alter table public.game_events add column if not exists sequence int;
alter table public.game_events add column if not exists result_version int;
alter table public.game_events add column if not exists event_type text;

update public.game_events set legacy = true where legacy is distinct from true;
update public.game_states set game_id = gen_random_uuid() where game_id is null;
update public.public_game_views v set game_id = gs.game_id
  from public.game_states gs where gs.room_id = v.room_id and v.game_id is null;
update public.private_player_views v set game_id = gs.game_id
  from public.game_states gs where gs.room_id = v.room_id and v.game_id is null;
update public.game_states set state = jsonb_set(state, '{gameId}', to_jsonb(game_id::text))
  where game_id is not null and state->>'gameId' is distinct from game_id::text;
update public.public_game_views set view = jsonb_set(view, '{gameId}', to_jsonb(game_id::text))
  where game_id is not null and view->>'gameId' is distinct from game_id::text;
update public.private_player_views set view = jsonb_set(view, '{gameId}', to_jsonb(game_id::text))
  where game_id is not null and view->>'gameId' is distinct from game_id::text;

create table if not exists public.game_event_batches (
  batch_id uuid primary key,
  room_id uuid not null references public.rooms(room_id) on delete cascade,
  game_id uuid not null,
  from_version int not null check (from_version >= 0),
  to_version int not null check (to_version >= 1 and to_version >= from_version),
  created_at timestamptz not null default now(),
  unique (game_id, from_version)
);
create table if not exists public.applied_actions (
  action_id uuid primary key,
  room_id uuid not null references public.rooms(room_id) on delete cascade,
  response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.game_event_batches enable row level security;
alter table public.applied_actions enable row level security;

create or replace function public.apply_turn_batch(
  p_room_id uuid, p_transition_mode text, p_expected_game_id uuid,
  p_expected_version int, p_batch_from_version int, p_action_id uuid,
  p_new_state jsonb, p_public_view jsonb, p_private_views jsonb,
  p_events jsonb, p_room_status text, p_winner_player_id uuid,
  p_replaced_player_id uuid default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_room public.rooms%rowtype;
  v_state public.game_states%rowtype;
  v_state_exists boolean;
  v_cached_response jsonb;
  v_cached_room_id uuid;
  v_new_game_id uuid;
  v_new_version int;
  v_row_count int;
  v_input_total int;
  v_input_distinct int;
  v_invalid_player_count int;
  v_final_private_count int;
  v_bad_view_count int;
  v_event_count int;
  v_seq_distinct int;
  v_bad_event_count int;
begin
  select * into v_room from public.rooms where room_id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select room_id, response into v_cached_room_id, v_cached_response
    from public.applied_actions where action_id = p_action_id;
  if found then
    if v_cached_room_id is distinct from p_room_id then raise exception 'ACTION_ID_ROOM_MISMATCH'; end if;
    return v_cached_response;
  end if;

  select * into v_state from public.game_states where room_id = p_room_id;
  v_state_exists := found;

  begin
    v_new_game_id := (p_new_state->>'gameId')::uuid;
    v_new_version := (p_new_state->>'version')::int;
  exception when others then raise exception 'INVALID_STATE_IDENTITY'; end;
  if v_new_game_id is null or v_new_version is null or v_new_version < 1 then raise exception 'INVALID_STATE_IDENTITY'; end if;
  if (p_new_state->>'roomId')::uuid is distinct from p_room_id then raise exception 'STATE_ROOM_ID_MISMATCH'; end if;
  if (p_public_view->>'roomId')::uuid is distinct from p_room_id
     or (p_public_view->>'gameId')::uuid is distinct from v_new_game_id then
    raise exception 'PUBLIC_VIEW_IDENTITY_MISMATCH';
  end if;
  if jsonb_typeof(p_private_views) is distinct from 'array' then raise exception 'INVALID_PRIVATE_VIEWS_PAYLOAD'; end if;
  -- PrivatePlayerState (src/game/types.ts) has no top-level roomId/gameId of
  -- its own -- both live nested under its `publicState` field (which IS a
  -- full PublicGameState). Checking a top-level `roomId` here always read
  -- NULL and rejected every real, non-empty private-views payload.
  select count(*) into v_bad_view_count from jsonb_to_recordset(p_private_views) as e(player_id uuid, view jsonb)
    where (e.view->'publicState'->>'roomId')::uuid is distinct from p_room_id
       or (e.view->'publicState'->>'gameId')::uuid is distinct from v_new_game_id;
  if v_bad_view_count > 0 then raise exception 'PRIVATE_VIEW_IDENTITY_MISMATCH'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' then raise exception 'INVALID_EVENTS_PAYLOAD'; end if;
  if p_room_status not in ('PLAYING', 'FINISHED') then raise exception 'INVALID_ROOM_STATUS'; end if;

  if not v_state_exists then
    if p_transition_mode is distinct from 'START_GAME' then raise exception 'INVALID_TRANSITION_FOR_MISSING_STATE'; end if;
    if p_expected_game_id is not null or p_expected_version is not null then raise exception 'START_GAME_MUST_NOT_HAVE_EXPECTED_STATE'; end if;
    if v_room.status is distinct from 'LOBBY' then raise exception 'ROOM_NOT_IN_LOBBY'; end if;
    if v_new_version < 1 then raise exception 'INVALID_START_VERSION'; end if;
    if p_room_status not in ('PLAYING','FINISHED') then raise exception 'INVALID_TARGET_STATUS_FOR_TRANSITION'; end if;
    if p_batch_from_version <> 0 then raise exception 'INVALID_BATCH_BASE_VERSION'; end if;
  else
    if v_state.game_id is distinct from p_expected_game_id then raise exception 'GAME_CHANGED'; end if;
    if v_state.version is distinct from p_expected_version then raise exception 'STALE_GAME_STATE'; end if;
    if p_transition_mode = 'NEXT_ROUND' then
      if v_room.status is distinct from 'FINISHED' then raise exception 'ROOM_NOT_FINISHED'; end if;
      if v_new_game_id = p_expected_game_id then raise exception 'GAME_ID_UNCHANGED_ON_NEXT_ROUND'; end if;
      if v_new_version < 1 then raise exception 'INVALID_NEXT_ROUND_VERSION'; end if;
      if p_room_status not in ('PLAYING','FINISHED') then raise exception 'INVALID_TARGET_STATUS_FOR_TRANSITION'; end if;
      if p_batch_from_version <> 0 then raise exception 'INVALID_BATCH_BASE_VERSION'; end if;
    elsif p_transition_mode = 'NORMAL_ACTION' then
      if v_room.status is distinct from 'PLAYING' then raise exception 'ROOM_NOT_PLAYING'; end if;
      if v_new_game_id is distinct from p_expected_game_id then raise exception 'GAME_ID_MUST_NOT_CHANGE'; end if;
      if v_new_version <= p_expected_version then raise exception 'NON_MONOTONIC_VERSION'; end if;
      if p_batch_from_version is distinct from p_expected_version then raise exception 'BATCH_FROM_VERSION_MUST_MATCH_EXPECTED_VERSION'; end if;
    else raise exception 'INVALID_TRANSITION_FOR_EXISTING_STATE';
    end if;
  end if;
  if p_batch_from_version > v_new_version then raise exception 'INVALID_BATCH_RANGE'; end if;
  if p_room_status = 'FINISHED' and (p_new_state->>'phase') is distinct from 'GAME_OVER' then raise exception 'FINISHED_REQUIRES_GAME_OVER_PHASE'; end if;
  if p_room_status = 'PLAYING' and (p_new_state->>'phase') = 'GAME_OVER' then raise exception 'PLAYING_MUST_NOT_BE_GAME_OVER_PHASE'; end if;
  if p_winner_player_id is not null then
    if p_room_status is distinct from 'FINISHED' then raise exception 'UNEXPECTED_WINNER'; end if;
    if (p_new_state->>'winnerPlayerId')::uuid is distinct from p_winner_player_id then raise exception 'WINNER_MISMATCH'; end if;
    perform 1 from public.players where player_id = p_winner_player_id and room_id = p_room_id;
    if not found then raise exception 'WINNER_NOT_IN_ROOM'; end if;
  elsif p_room_status = 'FINISHED' then raise exception 'MISSING_WINNER_FOR_GAME_OVER'; end if;

  select count(*) into v_event_count from jsonb_array_elements(p_events);
  if v_event_count > 0 then
    select count(distinct (e->>'sequence')::int) into v_seq_distinct from jsonb_array_elements(p_events) e;
    if v_seq_distinct <> v_event_count then raise exception 'EVENT_SEQUENCE_NOT_CONTIGUOUS'; end if;
    if exists (select 1 from generate_series(0, v_event_count - 1) expected(seq)
      where not exists (select 1 from jsonb_array_elements(p_events) e where (e->>'sequence')::int = expected.seq))
    then raise exception 'EVENT_SEQUENCE_NOT_CONTIGUOUS'; end if;
    select count(*) into v_bad_event_count from jsonb_array_elements(p_events) e
      where e->>'type' not in ('DRAW','PLAY_CARD','CHOSE_COLOR','CHOSE_SWAP_TARGET','CHOSE_SKIP_TARGET','DISCARDED_EXTRA','HANDS_ROTATED','HANDS_SWAPPED','DRAW_STACK_INCREASED','DRAW_STACK_RESOLVED','PLAYER_ELIMINATED','GAME_OVER')
         or (e->>'resultVersion')::int <= p_batch_from_version or (e->>'resultVersion')::int > v_new_version;
    if v_bad_event_count > 0 then raise exception 'INVALID_EVENT_PAYLOAD'; end if;
  end if;

  if p_replaced_player_id is not null then
    if p_transition_mode is distinct from 'NORMAL_ACTION' then raise exception 'INVALID_PLAYER_REPLACEMENT_TRANSITION'; end if;
    update public.players set player_type='BOT', bot_strategy_level='NORMAL', device_id=null
      where player_id=p_replaced_player_id and room_id=p_room_id and player_type='HUMAN';
    get diagnostics v_row_count = row_count;
    if v_row_count <> 1 then raise exception 'INVALID_REPLACED_PLAYER'; end if;
  end if;

  if p_transition_mode = 'NEXT_ROUND' then
    update public.players set eliminated=false where room_id=p_room_id;
  end if;

  if not v_state_exists then
    insert into public.game_states(room_id,game_id,version,state,updated_at) values(p_room_id,v_new_game_id,v_new_version,p_new_state,now());
    insert into public.public_game_views(room_id,game_id,version,view,updated_at) values(p_room_id,v_new_game_id,v_new_version,p_public_view,now());
  else
    update public.game_states set state=p_new_state,game_id=v_new_game_id,version=v_new_version,updated_at=now()
      where room_id=p_room_id and game_id=p_expected_game_id and version=p_expected_version;
    get diagnostics v_row_count=row_count; if v_row_count<>1 then raise exception 'GAME_STATE_UPDATE_FAILED'; end if;
    update public.public_game_views set view=p_public_view,game_id=v_new_game_id,version=v_new_version,updated_at=now() where room_id=p_room_id;
    get diagnostics v_row_count=row_count; if v_row_count<>1 then raise exception 'PUBLIC_VIEW_UPDATE_FAILED'; end if;
  end if;

  select count(*),count(distinct e.player_id) into v_input_total,v_input_distinct
    from jsonb_to_recordset(p_private_views) e(player_id uuid,view jsonb);
  if v_input_total<>v_input_distinct then raise exception 'DUPLICATE_PLAYER_ID_IN_INPUT'; end if;
  select count(*) into v_invalid_player_count from jsonb_to_recordset(p_private_views) e(player_id uuid,view jsonb)
    left join public.players pl on pl.player_id=e.player_id and pl.room_id=p_room_id and pl.player_type='HUMAN'
    where pl.player_id is null;
  if v_invalid_player_count>0 then raise exception 'FOREIGN_OR_INVALID_PLAYER_ID'; end if;
  insert into public.private_player_views(room_id,player_id,game_id,version,view,updated_at)
    select p_room_id,e.player_id,v_new_game_id,v_new_version,e.view,now() from jsonb_to_recordset(p_private_views) e(player_id uuid,view jsonb)
    on conflict(player_id) do update set room_id=excluded.room_id,view=excluded.view,game_id=excluded.game_id,version=excluded.version,updated_at=now();
  delete from public.private_player_views v where v.room_id=p_room_id
    and not exists(select 1 from jsonb_to_recordset(p_private_views) e(player_id uuid,view jsonb) where e.player_id=v.player_id);
  select count(*) into v_final_private_count from public.private_player_views where room_id=p_room_id;
  if v_final_private_count<>v_input_distinct then raise exception 'PRIVATE_VIEW_SYNC_MISMATCH'; end if;

  insert into public.game_event_batches(batch_id,room_id,game_id,from_version,to_version)
    values(p_action_id,p_room_id,v_new_game_id,p_batch_from_version,v_new_version);
  insert into public.game_events(batch_id,room_id,game_id,sequence,actor_player_id,action_type,event_type,public_payload,result_version,legacy)
    select p_action_id,p_room_id,v_new_game_id,(e->>'sequence')::int,(e->>'actorPlayerId')::uuid,e->>'type',e->>'type',e->'payload',(e->>'resultVersion')::int,false
    from jsonb_array_elements(p_events) e;
  update public.rooms set status=p_room_status where room_id=p_room_id;
  if p_winner_player_id is not null then
    update public.players set wins=wins+1 where player_id=p_winner_player_id and room_id=p_room_id;
    get diagnostics v_row_count=row_count; if v_row_count<>1 then raise exception 'WINNER_UPDATE_FAILED'; end if;
  end if;
  v_cached_response:=jsonb_build_object('ok',true,'gameId',v_new_game_id,'version',v_new_version,'batchId',p_action_id);
  insert into public.applied_actions(action_id,room_id,response) values(p_action_id,p_room_id,v_cached_response);
  return v_cached_response;
end; $$;

revoke all on function public.apply_turn_batch(uuid,text,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.apply_turn_batch(uuid,text,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid,uuid) to service_role;
