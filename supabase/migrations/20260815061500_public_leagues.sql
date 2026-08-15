-- Public leagues: a league an organizer chooses to make discoverable, so someone
-- can find and join it from Browse instead of needing an invite link.
--
-- Three things are needed. A flag saying the league is discoverable, a size the
-- organizer sets so "seats left" means something, and coordinates on a meetup so
-- Browse can tell how far away a league is.
alter table public.leagues
  -- Off by default. A league that exists today was created privately and must
  -- not become discoverable because this migration ran.
  add column is_public boolean not null default false,
  -- Null means no cap. Browse then always counts the league as having room,
  -- which is the honest reading of "the organizer set no limit".
  add column max_members integer
    check (max_members is null or max_members between 1 and 200);

-- A meetup's venue gains a position, the same nullable pair matches carry and for
-- the same reason: venues typed by hand have none, and every session created
-- before now has none either.
alter table public.league_sessions
  add column latitude double precision,
  add column longitude double precision,
  add constraint league_sessions_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint league_sessions_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  add constraint league_sessions_coordinates_paired
    check ((latitude is null) = (longitude is null));

-- The directory Browse reads.
--
-- A function rather than widening the select policy on `leagues`. That policy is
-- membership-based, and relaxing it to `is_public or ...` would hand every signed
-- -in member the `invite_token` of every public league — which is the credential
-- that joins one, bypassing the capacity check below. This returns only what a
-- card needs, and nothing that grants access.
--
-- Security definer so it can count members and read sessions for a league the
-- caller is not in. `search_path` is pinned per Supabase's guidance.
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
    -- Null max means no cap, so null seats_left reads as "room, unspecified".
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
  -- The soonest meetup still to come, which is what a card shows and what Browse
  -- measures distance against. Left join: a league with no sessions yet is still
  -- a league someone can join.
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
  -- A caller with no session gets nothing, rather than the whole directory.
  and (select auth.uid()) is not null;
$$;

-- Join a public league by id.
--
-- The counterpart to join_league_with_token, for a league that needs no token
-- because it advertised itself. Definer for the same reason: the caller cannot
-- read the league's row, let alone count its members, so the capacity check has
-- to happen here.
create or replace function public.join_public_league(p_league_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_is_public boolean;
  v_max integer;
  v_count integer;
begin
  if v_caller is null then
    raise exception 'You must be signed in to join a league.';
  end if;

  select l.is_public, l.max_members into v_is_public, v_max
  from public.leagues l
  where l.id = p_league_id;

  -- Same message for "no such league" and "not public", so this cannot be used
  -- to probe which private leagues exist.
  if v_is_public is not true then
    raise exception 'That league is not open to join.';
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

    -- Checked here, inside the same statement that inserts, rather than trusted
    -- from the client's copy of the count — which may be minutes old.
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

-- Postgres grants EXECUTE on every new function to PUBLIC, and `anon` inherits
-- it, so revoking from `anon` alone is a no-op. This is the fourth time that has
-- come up — see 20260806010530, 20260808174717 and 20260808174941.
revoke all on function public.public_leagues() from public, anon;
revoke all on function public.join_public_league(uuid) from public, anon;
grant execute on function public.public_leagues() to authenticated;
grant execute on function public.join_public_league(uuid) to authenticated;

comment on column public.leagues.is_public is
  'Discoverable from Browse. Off by default; the organizer opts in.';
comment on column public.leagues.max_members is
  'Cap the organizer set, or null for no cap. Enforced in join_public_league().';
