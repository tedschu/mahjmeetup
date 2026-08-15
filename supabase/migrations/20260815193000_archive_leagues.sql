-- Archiving a league.
--
-- An organizer who creates a league has, until now, had no way to get rid of it:
-- it sits on the Leagues screen forever, and if it was public it stays in Browse
-- offering seats at a season nobody is running.
--
-- Deleting one is already permitted — the delete policy on `leagues` is
-- organizer-only, from 20260808163809 — but deleting is the wrong default, and
-- for a reason worth writing down. `matches.session_id` references
-- `league_sessions` ON DELETE CASCADE, so removing a league cascades through its
-- seasons and meetups and takes the drawn tables with it, and `match_players`
-- cascades from those. Every score anyone recorded goes. (Matches merely *tagged*
-- with the league — a pick-up game whose host said it counted — survive: that
-- column is ON DELETE SET NULL, so they revert to pick-up games.)
--
-- So the reversible option comes first. An archived league keeps its history and
-- its standings, stops being discoverable, and can be brought back.
alter table public.leagues
  -- Null means live. A timestamp rather than a boolean because "when did this
  -- stop" is the question anyone asks next, and it costs the same to store.
  add column archived_at timestamptz;

comment on column public.leagues.archived_at is
  'When the organizer archived this league, or null while it is live. Archived leagues keep their seasons, tables and standings but are not discoverable and accept no new members.';

-- Browse stops offering archived leagues.
--
-- Replaced whole rather than patched, because that is the only way to change the
-- body of a function. The one difference from 20260815061500 is the archived_at
-- test in the where clause.
create or replace function public.public_leagues()
returns table (
  id uuid,
  name text,
  color text,
  member_count integer,
  max_members integer,
  seats_left integer,
  is_member boolean,
  next_meetup timestamptz,
  next_location text,
  next_latitude double precision,
  next_longitude double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.name,
    l.color,
    counted.member_count::integer,
    l.max_members,
    case when l.max_members is null then null
         else greatest(0, l.max_members - counted.member_count)::integer end,
    exists (
      select 1 from public.league_members lm
      where lm.league_id = l.id and lm.profile_id = (select auth.uid())
    ),
    upcoming.date_time,
    upcoming.location,
    upcoming.latitude,
    upcoming.longitude
  from public.leagues l
  cross join lateral (
    select count(*) as member_count
    from public.league_members lm
    where lm.league_id = l.id
  ) counted
  left join lateral (
    select ls.date_time, ls.location, ls.latitude, ls.longitude
    from public.league_sessions ls
    join public.seasons s on s.id = ls.season_id
    where s.league_id = l.id
      and ls.date_time >= timezone('utc'::text, now())
    order by ls.date_time
    limit 1
  ) upcoming on true
  where l.is_public
    -- New: a league that has been put away is not on offer, whatever its
    -- is_public flag still says. Archiving therefore un-lists a league without
    -- destroying the setting it had, so unarchiving restores it as it was.
    and l.archived_at is null
  and (select auth.uid()) is not null;
$$;

-- Joining is refused for the same reason, and has to be checked here rather than
-- relying on the listing: the id of a league someone saw yesterday is enough to
-- call this directly.
create or replace function public.join_public_league(p_league_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_is_public boolean;
  v_archived timestamptz;
  v_max integer;
  v_count integer;
begin
  if v_caller is null then
    raise exception 'You must be signed in to join a league.';
  end if;

  select l.is_public, l.archived_at, l.max_members
    into v_is_public, v_archived, v_max
  from public.leagues l
  where l.id = p_league_id;

  -- Same message for "no such league" and "not public", so this cannot be used
  -- to probe which private leagues exist.
  if v_is_public is not true then
    raise exception 'That league is not open to join.';
  end if;

  -- Said plainly, unlike the case above: an archived league is one the caller
  -- could legitimately have seen a moment ago, so "not open to join" would look
  -- like a bug rather than an answer.
  if v_archived is not null then
    raise exception 'That league has been archived.';
  end if;

  -- Already in: succeed quietly rather than erroring, so a double tap or a stale
  -- list does not produce a failure the member cannot act on.
  if exists (
    select 1 from public.league_members lm
    where lm.league_id = p_league_id and lm.profile_id = v_caller
  ) then
    return p_league_id;
  end if;

  if v_max is not null then
    select count(*) into v_count
    from public.league_members lm
    where lm.league_id = p_league_id;

    if v_count >= v_max then
      raise exception 'That league is full.';
    end if;
  end if;

  insert into public.league_members (league_id, profile_id, role)
  values (p_league_id, v_caller, 'member')
  on conflict (league_id, profile_id) do nothing;

  return p_league_id;
end;
$$;

-- An invite link to an archived league stops working too. Otherwise archiving
-- would close the front door and leave the side one open — and links to a league
-- that ran for a season are exactly the ones still sitting in people's messages.
create or replace function public.join_league_with_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target uuid;
  archived timestamptz;
begin
  if caller is null then
    raise exception 'You must be signed in to join a league.';
  end if;

  select id, archived_at into target, archived
  from public.leagues
  where invite_token = btrim(p_token);

  if target is null then
    raise exception 'That invite link is not valid.';
  end if;

  if archived is not null then
    raise exception 'That league has been archived.';
  end if;

  insert into public.league_members (league_id, profile_id, role)
  values (target, caller, 'member')
  on conflict (league_id, profile_id) do nothing;

  return target;
end;
$$;

-- `create or replace` keeps a function's existing privileges, so these are a
-- re-assertion rather than a fix. Kept because the alternative is trusting that
-- nobody ever drops and recreates one of these by hand — and the PUBLIC-inherits
-- -to-anon trap has now caught this project four times (see 20260806010530,
-- 20260808174717, 20260808174941 and 20260815061500).
revoke all on function public.public_leagues() from public, anon;
revoke all on function public.join_public_league(uuid) from public, anon;
revoke all on function public.join_league_with_token(text) from public, anon;
grant execute on function public.public_leagues() to authenticated;
grant execute on function public.join_public_league(uuid) to authenticated;
grant execute on function public.join_league_with_token(text) to authenticated;
