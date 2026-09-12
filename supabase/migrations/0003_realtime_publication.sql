-- Postgres Changes (used by the Lobby to live-update the player list, and by
-- RoomPage to react to a room's status flipping LOBBY -> PLAYING) only fires
-- for tables added to the `supabase_realtime` publication. Only safe, public
-- tables are added here — never game_states or private_player_views.
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table rooms;
