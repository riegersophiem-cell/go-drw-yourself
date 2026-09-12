-- pgcrypto (and its digest() function) lives in the `extensions` schema on
-- Supabase projects, not `public`. get_private_state's search_path needs to
-- include it or `digest()` resolves to nothing.
create or replace function get_private_state(p_device_id uuid, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device devices%rowtype;
  v_view private_player_views%rowtype;
begin
  select * into v_device from devices where device_id = p_device_id;

  if not found then
    raise exception 'UNKNOWN_DEVICE';
  end if;

  if v_device.session_token_hash <> encode(digest(p_session_token, 'sha256'), 'hex') then
    raise exception 'INVALID_SESSION';
  end if;

  if v_device.player_id is null then
    raise exception 'DEVICE_HAS_NO_PLAYER';
  end if;

  select * into v_view from private_player_views where player_id = v_device.player_id;
  if not found then
    return null;
  end if;

  return v_view.view;
end;
$$;

revoke all on function get_private_state(uuid, text) from public;
grant execute on function get_private_state(uuid, text) to anon, authenticated;
