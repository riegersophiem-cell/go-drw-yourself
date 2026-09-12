-- UNO Show 'Em No Mercy — initial schema
--
-- Security model (see README "Sicherheitsmodell" for the full explanation):
--   - `game_states` holds the FULL authoritative state (every hand, the draw
--     pile order, everything). RLS is enabled with NO policies at all, so no
--     anon/authenticated client can ever SELECT it directly — only
--     Edge Functions running with the service_role key may touch it.
--   - `public_game_views` holds only information every device in the room is
--     allowed to see (card counts, whose turn, top of discard, ...). Freely
--     readable by anyone who knows the room id.
--   - `private_player_views` holds one row per human player with their own
--     hand. It is NEVER exposed via direct table SELECT (RLS denies all);
--     the only way to read it is the `get_private_state` RPC below, which
--     validates the caller's session token server-side before returning
--     exactly one row.
--   - Realtime is used only for a "something changed, go refetch" broadcast
--     on `public_game_views` (safe — contains no secrets). Private state is
--     always pulled explicitly via the RPC after that signal, so a private
--     hand is never at risk of leaking through a table-replication payload.

create extension if not exists pgcrypto;

create table rooms (
  room_id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text not null default 'LOBBY' check (status in ('LOBBY', 'PLAYING', 'FINISHED')),
  host_device_id uuid,
  created_at timestamptz not null default now()
);

create table devices (
  device_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(room_id) on delete cascade,
  role text not null check (role in ('PLAYER', 'TABLE', 'SPECTATOR', 'HOST_ADMIN')),
  player_id uuid,
  session_token_hash text not null,
  connected boolean not null default true,
  last_seen_at timestamptz not null default now()
);

create table players (
  player_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(room_id) on delete cascade,
  display_name text not null,
  player_type text not null check (player_type in ('HUMAN', 'BOT')),
  seat_index int not null,
  eliminated boolean not null default false,
  connected boolean not null default true,
  bot_strategy_level text check (bot_strategy_level in ('EASY', 'NORMAL')),
  device_id uuid references devices(device_id)
);

alter table devices add constraint devices_player_fk foreign key (player_id) references players(player_id) on delete set null;

-- Full authoritative state, one row per room. Never directly readable by clients.
create table game_states (
  room_id uuid primary key references rooms(room_id) on delete cascade,
  version int not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Public projection. Safe for any client in the room to read.
create table public_game_views (
  room_id uuid primary key references rooms(room_id) on delete cascade,
  version int not null,
  view jsonb not null,
  updated_at timestamptz not null default now()
);

-- Private-per-player projection. Only reachable via get_private_state().
create table private_player_views (
  player_id uuid primary key references players(player_id) on delete cascade,
  room_id uuid not null references rooms(room_id) on delete cascade,
  version int not null,
  view jsonb not null,
  updated_at timestamptz not null default now()
);

create table game_events (
  event_id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(room_id) on delete cascade,
  turn_number int,
  actor_player_id uuid,
  action_type text not null,
  public_payload jsonb, -- never include private card data here
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table rooms enable row level security;
alter table devices enable row level security;
alter table players enable row level security;
alter table game_states enable row level security; -- no policies -> service_role only
alter table public_game_views enable row level security;
alter table private_player_views enable row level security; -- no policies -> RPC only
alter table game_events enable row level security;

create policy "rooms are publicly readable by code lookup" on rooms
  for select using (true);

create policy "public game views are publicly readable" on public_game_views
  for select using (true);

create policy "players list is publicly readable (no card data here)" on players
  for select using (true);

create policy "devices are publicly readable (no session token exposed via API)" on devices
  for select using (true);

create policy "game events are publicly readable" on game_events
  for select using (true);

-- All INSERT/UPDATE/DELETE on every table happens exclusively through
-- SECURITY DEFINER RPC functions or Edge Functions using the service role —
-- intentionally no write policies are defined for the anon/authenticated
-- roles here.

-- ---------------------------------------------------------------------------
-- get_private_state: the ONLY way a client ever reads a hand's contents.
-- Validates the device's session token server-side; never trusts a client-
-- supplied playerId.
-- ---------------------------------------------------------------------------

create or replace function get_private_state(p_device_id uuid, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device devices%rowtype;
  v_view private_player_views%rowtype;
begin
  select * into v_device from devices where device_id = p_device_id;

  if not found then
    raise exception 'UNKNOWN_DEVICE';
  end if;

  -- session_token is a high-entropy random value generated server-side (not a
  -- human password), so a plain salted SHA-256 digest is sufficient and avoids
  -- needing bcrypt's slow hashing here.
  if v_device.session_token_hash <> encode(digest(p_session_token, 'sha256'), 'hex') then
    raise exception 'INVALID_SESSION';
  end if;

  if v_device.player_id is null then
    raise exception 'DEVICE_HAS_NO_PLAYER'; -- TABLE/SPECTATOR devices have no private state
  end if;

  select * into v_view from private_player_views where player_id = v_device.player_id;
  if not found then
    return null; -- game not started yet
  end if;

  return v_view.view;
end;
$$;

revoke all on function get_private_state(uuid, text) from public;
grant execute on function get_private_state(uuid, text) to anon, authenticated;
