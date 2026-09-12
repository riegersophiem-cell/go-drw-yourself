-- Tracks round wins across "NÄCHSTE RUNDE" within the same room (match
-- score). Reset only happens implicitly by creating a brand new room
-- ("NEUES SPIEL"), never by playing another round in the same one.
alter table players add column wins int not null default 0;
