-- Players pick an illustrated avatar before the round instead of just
-- initials; bots get one of several distinct robot avatars so they are
-- visually tellable apart. The id set lives in src/game/avatars.ts, not
-- here, so the actual artwork can change without another migration.
alter table players add column avatar text not null default 'H01';
