-- Moving a meetup, and the tables drawn from it.
--
-- A meetup could be deleted and re-added but never changed, so an organizer whose
-- venue fell through had to destroy the draw and reseat everybody — which is not a
-- correction, it is a different evening. Worse, once tables are drawn the meetup's
-- details have been copied onto them: `draw_league_session` writes date_time,
-- location and location_detail onto each match, and those copies are what the
-- players actually see in My Matches. Editing the session alone would move the
-- meetup on the league screen and leave four tables pointing at the old room.
--
-- So both are written here, together, and by an organizer rather than by whoever
-- happened to be dealt first. This has to be `security definer` for that: the
-- update policy on `matches` is host-only, and the host of a drawn table is a
-- random member. The organizer is checked explicitly against the league instead.
create or replace function public.update_league_session(
  p_session_id uuid,
  p_date_time timestamptz,
  p_location text,
  p_location_detail text,
  p_latitude double precision,
  p_longitude double precision
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league uuid;
  v_tables integer;
begin
  select s.league_id
    into v_league
  from public.league_sessions ls
  join public.seasons s on s.id = ls.season_id
  where ls.id = p_session_id;

  if v_league is null then
    raise exception 'That meetup no longer exists.';
  end if;

  -- The whole reason this function bypasses RLS, so it is the first thing it does.
  if not public.is_league_organizer(v_league) then
    raise exception 'Only an organizer can change a meetup.';
  end if;

  -- Coordinates are written as a pair or not at all; the table's check constraint
  -- refuses one without the other, and a venue typed by hand has neither.
  update public.league_sessions
  set date_time = p_date_time,
      location = p_location,
      location_detail = p_location_detail,
      latitude = p_latitude,
      longitude = p_longitude
  where id = p_session_id;

  -- Only tables still to be played. A completed table is a record of an evening
  -- that happened somewhere, and a canceled one is not going to happen at all;
  -- rewriting either would be falsifying it rather than rescheduling it.
  --
  -- These carry coordinates now, which the draw itself does not copy — so a moved
  -- meetup gains a working map link that a freshly drawn one still lacks.
  update public.matches
  set date_time = p_date_time,
      location = p_location,
      location_detail = p_location_detail,
      latitude = p_latitude,
      longitude = p_longitude
  where session_id = p_session_id
    and status in ('open', 'full');

  get diagnostics v_tables = row_count;
  return v_tables;
end;
$$;

-- Postgres grants EXECUTE on a new function to PUBLIC and anon inherits from
-- PUBLIC, so without this an anonymous caller could reach a definer function that
-- deliberately writes past RLS. The organizer check inside would refuse them —
-- `auth.uid()` is null — but that is the second line of defence, not the first.
revoke all on function public.update_league_session(
  uuid, timestamptz, text, text, double precision, double precision
) from public, anon;

grant execute on function public.update_league_session(
  uuid, timestamptz, text, text, double precision, double precision
) to authenticated;
