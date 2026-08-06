-- Seating rules for matches, enforced in the database rather than the client.
--
-- Two reasons these cannot live in the app:
--   1. "A match closes when four players are registered", but the matches RLS
--      policy only lets the host UPDATE. A member taking the fourth seat has no
--      permission to flip the status, so the client physically cannot do it.
--   2. Capacity and status would otherwise depend on every caller remembering
--      to check. A concurrent pair of joins could both see three seats and both
--      insert, overfilling the table.

-- Number of seats at a mahjong table.
create or replace function public.match_seat_limit()
returns integer
language sql
immutable
as $$ select 4 $$;

-- Reject a join when the match is already full or no longer accepting players.
create or replace function public.enforce_match_capacity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_status text;
  seated integer;
begin
  select status into match_status
    from public.matches
    where id = new.match_id
    for update;  -- serialises concurrent joins on the same match

  if match_status is null then
    raise exception 'Match not found.';
  end if;

  if match_status not in ('open', 'full') then
    raise exception 'This match is % and is not accepting players.', match_status;
  end if;

  select count(*) into seated
    from public.match_players
    where match_id = new.match_id;

  if seated >= public.match_seat_limit() then
    raise exception 'This match already has % players.', public.match_seat_limit();
  end if;

  return new;
end;
$$;

create trigger enforce_match_capacity_before_insert
  before insert on public.match_players
  for each row execute function public.enforce_match_capacity();

-- Keep matches.status in sync with the seat count as members join and leave.
-- Only toggles between open and full; completed and canceled are left alone so
-- a host correcting scores cannot accidentally reopen a finished match.
create or replace function public.sync_match_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.match_id, old.match_id);
  seated integer;
begin
  select count(*) into seated
    from public.match_players
    where match_id = target;

  update public.matches
    set status = case
      when seated >= public.match_seat_limit() then 'full'
      else 'open'
    end
    where id = target
      and status in ('open', 'full');

  return null;
end;
$$;

create trigger sync_match_status_after_change
  after insert or delete on public.match_players
  for each row execute function public.sync_match_status();

-- The host holds a seat like anyone else, so proposing a match should seat them
-- automatically (PRD: "The host automatically takes one of four seats").
create or replace function public.seat_host_on_match_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.match_players (match_id, player_id)
  values (new.id, new.host_id)
  on conflict do nothing;
  return null;
end;
$$;

create trigger seat_host_after_match_insert
  after insert on public.matches
  for each row execute function public.seat_host_on_match_insert();
