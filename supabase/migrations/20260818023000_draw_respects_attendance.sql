-- The draw stops dealing seats to people who have said they are out.
--
-- This is the change that makes attendance worth collecting. Without it the two
-- features sit side by side and disagree: a member marks themselves out, the
-- organizer draws, and the tables seat them anyway.
--
-- It is also a change to something that already works and that people have used,
-- so the narrowest possible one: a single `not exists` on the roster select. The
-- shuffle, the round-robin deal, the host rule and the redraw guard are all
-- exactly as they were.
--
-- Coordinates are copied onto the tables now as well. The draw never did, so a
-- drawn table had no position and Browse could not measure it — an omission that
-- only showed up when moving a meetup started writing them.
create or replace function public.draw_league_session(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league uuid;
  v_when timestamptz;
  v_location text;
  v_detail text;
  v_latitude double precision;
  v_longitude double precision;
  v_seats integer := public.match_seat_limit();
  v_roster uuid[];
  v_count integer;
  v_members integer;
  v_tables integer;
  v_seatmates uuid[];
  v_match uuid;
  i integer;
begin
  select se.league_id, ls.date_time, ls.location, ls.location_detail, ls.latitude, ls.longitude
    into v_league, v_when, v_location, v_detail, v_latitude, v_longitude
  from public.league_sessions ls
  join public.seasons se on se.id = ls.season_id
  where ls.id = p_session_id;

  if v_league is null then
    raise exception 'Session not found.';
  end if;

  if not public.is_league_organizer(v_league) then
    raise exception 'Only a league organizer can draw the tables.';
  end if;

  if exists (
    select 1 from public.matches
    where session_id = p_session_id and status = 'completed'
  ) then
    raise exception 'A table in this session has already been played. Redrawing would erase its scores.';
  end if;

  delete from public.matches where session_id = p_session_id;

  -- order by random() is the shuffle. Every draw is independent, so the same
  -- four people can land together twice running; that is what random means, and
  -- deliberately avoiding it would be a different feature.
  --
  -- Closed accounts are skipped. Their membership row survives so their results
  -- stay in the standings, but dealing them a seat would seat a tombstone — a
  -- table nobody can score, hosted by nobody if they were dealt first.
  --
  -- So are members who have said they are out for this meetup. Silence is not
  -- absence: somebody who has answered nothing is dealt in, which is what the
  -- summary's "no answer" count exists to qualify.
  select array_agg(lm.profile_id order by random())
    into v_roster
  from public.league_members lm
  join public.profiles p on p.id = lm.profile_id
  where lm.league_id = v_league
    and p.deleted_at is null
    and not exists (
      select 1 from public.session_attendance sa
      where sa.session_id = p_session_id
        and sa.profile_id = lm.profile_id
        and sa.status = 'out'
    );

  v_count := coalesce(array_length(v_roster, 1), 0);

  if v_count = 0 then
    -- Told apart, because they need different things doing about them: an empty
    -- league needs members, a league where everybody is out needs another date.
    select count(*) into v_members
    from public.league_members lm
    join public.profiles p on p.id = lm.profile_id
    where lm.league_id = v_league and p.deleted_at is null;

    if v_members = 0 then
      raise exception 'This league has no members yet.';
    end if;

    raise exception 'Everybody has said they cannot make this meetup.';
  end if;

  v_tables := ceil(v_count::numeric / v_seats);

  for i in 1..v_tables loop
    -- Dealt round-robin rather than in blocks, so sizes stay even: six members
    -- become two tables of three, not a four and a two.
    select array_agg(v_roster[j])
      into v_seatmates
    from generate_series(i, v_count, v_tables) as g(j);

    -- The first player dealt to a table hosts it. Someone has to, the host holds
    -- a seat anyway, and it spreads scorekeeping around instead of parking every
    -- table on the organizer.
    insert into public.matches (
      host_id, date_time, location, location_detail, latitude, longitude,
      league_id, session_id, table_number, status
    )
    values (
      v_seatmates[1], v_when, v_location, v_detail, v_latitude, v_longitude,
      v_league, p_session_id, i, 'open'
    )
    returning id into v_match;

    -- The host's own seat is taken by seat_host_on_match_insert.
    if array_length(v_seatmates, 1) > 1 then
      insert into public.match_players (match_id, player_id)
      select v_match, unnest(v_seatmates[2:]);
    end if;
  end loop;

  return v_tables;
end;
$$;

revoke all on function public.draw_league_session(uuid) from public, anon;
grant execute on function public.draw_league_session(uuid) to authenticated;
