-- Lets Browse say which leagues are new.
--
-- The match cards can already mark a table as just added, because a match arrives
-- at the client with its `created_at`. A public league does not: `public_leagues()`
-- returns a hand-written column list, that column was never in it, and a league you
-- have not joined is invisible to RLS, so there is nowhere else to read it from.
--
-- Dropped and recreated rather than replaced. `create or replace function` cannot
-- change a return type, and this adds a column to the returned table — so the drop
-- is not tidiness, it is the only way. Which means the grants have to be restated
-- below: they do not survive a drop, and a function that exists with nobody able to
-- execute it fails in the client rather than in the migration.
drop function if exists public.public_leagues();

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
  next_location_detail text,
  next_latitude double precision,
  next_longitude double precision,
  -- Appended, so the client's existing field order is untouched.
  created_at timestamptz
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
    upcoming.location_detail,
    upcoming.latitude,
    upcoming.longitude,
    l.created_at
  from public.leagues l
  cross join lateral (
    select count(*) as member_count
    from public.league_members lm
    join public.profiles p on p.id = lm.profile_id
    where lm.league_id = l.id
      and p.deleted_at is null
  ) counted
  left join lateral (
    select ls.date_time, ls.location, ls.location_detail, ls.latitude, ls.longitude
    from public.league_sessions ls
    join public.seasons s on s.id = ls.season_id
    where s.league_id = l.id
      and ls.date_time >= timezone('utc'::text, now())
    order by ls.date_time
    limit 1
  ) upcoming on true
  where l.is_public
    and l.archived_at is null
  and (select auth.uid()) is not null;
$$;

-- Restated, and load-bearing. Postgres grants EXECUTE on a new function to PUBLIC,
-- and `anon` inherits from PUBLIC — so without the revoke this security definer
-- function, which deliberately reads past RLS, would be callable by anyone holding
-- the anon key. The body's own `auth.uid() is not null` would return nothing to
-- them, but that check is the second line rather than the first.
revoke all on function public.public_leagues() from public, anon;
grant execute on function public.public_leagues() to authenticated;
