-- Phase 5 / Paket 0B, Schritt 2: enforce constraints after verification and smoke test.
do $$ begin
  if exists(select 1 from public.game_states where game_id is null)
    or exists(select 1 from public.public_game_views where game_id is null)
    or exists(select 1 from public.private_player_views where game_id is null)
    or exists(select 1 from public.public_game_views v where not exists(select 1 from public.game_states s where s.room_id=v.room_id))
    or exists(select 1 from public.private_player_views v where not exists(select 1 from public.game_states s where s.room_id=v.room_id))
  then raise exception 'GAME_ID_BACKFILL_VERIFICATION_FAILED'; end if;
end $$;
alter table public.game_states alter column game_id set not null;
alter table public.public_game_views alter column game_id set not null;
alter table public.private_player_views alter column game_id set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='private_player_views_room_player_unique') then
    alter table public.private_player_views add constraint private_player_views_room_player_unique unique(room_id,player_id);
  end if;
  if not exists(select 1 from pg_constraint where conname='game_events_game_id_or_legacy') then
    alter table public.game_events add constraint game_events_game_id_or_legacy check(legacy or game_id is not null);
  end if;
  if not exists(select 1 from pg_constraint where conname='game_events_batch_or_legacy') then
    alter table public.game_events add constraint game_events_batch_or_legacy check(legacy or batch_id is not null);
  end if;
  if not exists(select 1 from pg_constraint where conname='game_events_batch_fk') then
    alter table public.game_events add constraint game_events_batch_fk foreign key(batch_id) references public.game_event_batches(batch_id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conname='game_events_batch_sequence_unique') then
    alter table public.game_events add constraint game_events_batch_sequence_unique unique(batch_id,sequence);
  end if;
  if not exists(select 1 from pg_constraint where conname='game_events_shape_or_legacy') then
    alter table public.game_events add constraint game_events_shape_or_legacy check(legacy or (sequence is not null and result_version is not null and event_type is not null));
  end if;
end $$;
