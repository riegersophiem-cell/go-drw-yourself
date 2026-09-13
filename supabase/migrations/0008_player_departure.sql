-- Host removal and voluntary departure. Both functions lock the room row so
-- a lobby removal cannot race the start of a game and an in-game departure
-- remains in the same transaction as the authoritative turn-batch commit.

create or replace function public.remove_lobby_player(
  p_room_id uuid,
  p_actor_device_id uuid,
  p_target_player_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_room public.rooms%rowtype;
  v_actor public.devices%rowtype;
  v_target public.players%rowtype;
  v_new_host_device_id uuid;
begin
  select * into v_room from public.rooms where room_id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status is distinct from 'LOBBY' then raise exception 'ROOM_NOT_IN_LOBBY'; end if;

  select * into v_actor from public.devices where device_id=p_actor_device_id and room_id=p_room_id and connected=true;
  if not found then raise exception 'UNKNOWN_DEVICE'; end if;
  select * into v_target from public.players where player_id=p_target_player_id and room_id=p_room_id;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
  if v_actor.player_id is distinct from p_target_player_id and v_room.host_device_id is distinct from p_actor_device_id then
    raise exception 'NOT_HOST';
  end if;

  if v_room.host_device_id = v_target.device_id then
    select d.device_id into v_new_host_device_id
      from public.players p join public.devices d on d.player_id=p.player_id
      where p.room_id=p_room_id and p.player_id<>p_target_player_id and p.player_type='HUMAN'
        and p.connected=true and d.connected=true
      order by p.seat_index limit 1;
    if v_new_host_device_id is null then
      delete from public.rooms where room_id=p_room_id;
      return jsonb_build_object('ok',true,'roomDeleted',true,'newHostDeviceId',null);
    end if;
    update public.rooms set host_device_id=v_new_host_device_id where room_id=p_room_id;
  end if;

  delete from public.players where room_id=p_room_id and player_id=p_target_player_id;
  -- `players.device_id` references `devices`, while `devices.player_id`
  -- references `players`. Delete the player first so the latter FK clears,
  -- then remove the captured device. The reverse order fails for humans.
  if v_target.device_id is not null then
    delete from public.devices where room_id=p_room_id and device_id=v_target.device_id;
  end if;
  return jsonb_build_object('ok',true,'roomDeleted',false,'newHostDeviceId',v_new_host_device_id);
end;
$$;

revoke all on function public.remove_lobby_player(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.remove_lobby_player(uuid,uuid,uuid) to service_role;

create or replace function public.apply_player_departure(
  p_room_id uuid,
  p_actor_device_id uuid,
  p_target_player_id uuid,
  p_departure_reason text,
  p_new_host_device_id uuid,
  p_expected_game_id uuid,
  p_expected_version int,
  p_batch_from_version int,
  p_action_id uuid,
  p_new_state jsonb,
  p_public_view jsonb,
  p_private_views jsonb,
  p_events jsonb,
  p_room_status text,
  p_winner_player_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_room public.rooms%rowtype;
  v_actor public.devices%rowtype;
  v_target public.players%rowtype;
  v_cached_room_id uuid;
  v_cached_response jsonb;
  v_response jsonb;
begin
  select * into v_room from public.rooms where room_id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  -- A network retry must return the first committed result before checking
  -- whether the target is still active; that first commit intentionally
  -- marked the target eliminated already.
  select room_id,response into v_cached_room_id,v_cached_response
    from public.applied_actions where action_id=p_action_id;
  if found then
    if v_cached_room_id is distinct from p_room_id then raise exception 'ACTION_ID_ROOM_MISMATCH'; end if;
    return v_cached_response;
  end if;

  if v_room.status is distinct from 'PLAYING' then raise exception 'ROOM_NOT_PLAYING'; end if;
  if p_departure_reason not in ('LEFT','REMOVED') then raise exception 'INVALID_DEPARTURE_REASON'; end if;

  select * into v_actor from public.devices where device_id=p_actor_device_id and room_id=p_room_id and connected=true;
  if not found then raise exception 'UNKNOWN_DEVICE'; end if;
  select * into v_target from public.players where player_id=p_target_player_id and room_id=p_room_id and eliminated=false;
  if not found then raise exception 'PLAYER_NOT_ACTIVE'; end if;
  if p_departure_reason='LEFT' and v_actor.player_id is distinct from p_target_player_id then raise exception 'CANNOT_LEAVE_FOR_OTHER_PLAYER'; end if;
  if p_departure_reason='REMOVED' and (v_room.host_device_id is distinct from p_actor_device_id or v_actor.player_id=p_target_player_id) then raise exception 'NOT_HOST'; end if;

  if v_room.host_device_id = v_target.device_id and p_new_host_device_id is not null then
    perform 1 from public.devices d join public.players p on p.player_id=d.player_id
      where d.device_id=p_new_host_device_id and d.room_id=p_room_id and d.connected=true
        and p.player_id<>p_target_player_id and p.player_type='HUMAN' and p.connected=true;
    if not found then raise exception 'INVALID_NEW_HOST'; end if;
  elsif v_room.host_device_id is distinct from v_target.device_id and p_new_host_device_id is not null then
    raise exception 'UNEXPECTED_NEW_HOST';
  end if;

  v_response := public.apply_turn_batch(
    p_room_id, 'NORMAL_ACTION', p_expected_game_id, p_expected_version,
    p_batch_from_version, p_action_id, p_new_state, p_public_view,
    p_private_views, p_events, p_room_status, p_winner_player_id, null
  );

  update public.players set eliminated=true, connected=false, device_id=null
    where player_id=p_target_player_id and room_id=p_room_id;
  update public.devices set connected=false where room_id=p_room_id and player_id=p_target_player_id;
  delete from public.private_player_views where room_id=p_room_id and player_id=p_target_player_id;
  if v_room.host_device_id = v_target.device_id then
    update public.rooms set host_device_id=p_new_host_device_id where room_id=p_room_id;
  end if;
  return v_response;
end;
$$;

revoke all on function public.apply_player_departure(uuid,uuid,uuid,text,uuid,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.apply_player_departure(uuid,uuid,uuid,text,uuid,uuid,int,int,uuid,jsonb,jsonb,jsonb,jsonb,text,uuid) to service_role;
