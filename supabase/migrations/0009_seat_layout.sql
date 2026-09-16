-- Seat layout persistence for TABLE_DEVICE's Seat Edit Mode.
--
-- This is deliberately a SEPARATE concept from players.seat_index (which is
-- turn order and must never be touched by a visual reseat). seat_order here
-- is purely "which player renders in which visual ring slot" on a given
-- room's table — see src/game/seatLayout.ts for the client-side mapping
-- logic and TABLE_UI_IMPLEMENTATION_REPORT.md section 5.

create table room_seat_layout (
  room_id uuid primary key references rooms(room_id) on delete cascade,
  seat_order jsonb not null, -- ordered array of player_id strings (visual slot order)
  updated_at timestamptz not null default now()
);

alter table room_seat_layout enable row level security;

create policy "seat layout is publicly readable" on room_seat_layout
  for select using (true);

-- No direct write policy — writes go exclusively through set_seat_layout()
-- below, which validates the calling device is the room's TABLE/HOST_ADMIN
-- device before touching anything (same session-token pattern as
-- get_private_state in 0001_init.sql).

create or replace function public.set_seat_layout(
  p_room_id uuid,
  p_device_id uuid,
  p_session_token text,
  p_seat_order jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_device devices%rowtype;
  v_player_count int;
  v_seat_count int;
  v_valid_count int;
begin
  select * into v_device from devices where device_id = p_device_id and room_id = p_room_id;
  if not found then
    raise exception 'UNKNOWN_DEVICE';
  end if;

  if v_device.session_token_hash <> encode(digest(p_session_token, 'sha256'), 'hex') then
    raise exception 'INVALID_SESSION';
  end if;

  if v_device.role not in ('TABLE', 'HOST_ADMIN') then
    raise exception 'SEAT_LAYOUT_REQUIRES_TABLE_DEVICE';
  end if;

  if jsonb_typeof(p_seat_order) <> 'array' then
    raise exception 'SEAT_ORDER_MUST_BE_ARRAY';
  end if;

  select count(*) into v_player_count from players where room_id = p_room_id and not eliminated;
  select count(*) into v_seat_count from jsonb_array_elements_text(p_seat_order);

  -- Every entry must reference a real, currently-seated player of this room —
  -- this is what stops a stray/forged id from ever being stored, it never
  -- touches turn order or hand ownership.
  select count(*) into v_valid_count
    from jsonb_array_elements_text(p_seat_order) as seat(player_id)
    join players p on p.player_id = seat.player_id::uuid and p.room_id = p_room_id and not p.eliminated;

  if v_seat_count <> v_player_count or v_valid_count <> v_player_count then
    raise exception 'SEAT_ORDER_MUST_MATCH_SEATED_PLAYERS';
  end if;

  insert into room_seat_layout (room_id, seat_order, updated_at)
  values (p_room_id, p_seat_order, now())
  on conflict (room_id) do update set seat_order = excluded.seat_order, updated_at = now();

  return p_seat_order;
end;
$$;

revoke all on function public.set_seat_layout(uuid, uuid, text, jsonb) from public;
grant execute on function public.set_seat_layout(uuid, uuid, text, jsonb) to anon, authenticated;

alter publication supabase_realtime add table room_seat_layout;
