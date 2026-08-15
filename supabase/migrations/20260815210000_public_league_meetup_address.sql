-- The next meetup's street address, for the league sheet in Browse.
--
-- `public_leagues()` already returns the meetup's venue name and position, which
-- was enough for a card: a card shows "Riverside Community Room" and how far away
-- it is. Opening that card now shows the meetup properly, and the one thing
-- somebody deciding whether to join a league wants — where they would actually be
-- going — was the one thing not returned.
--
-- Added rather than joined for on the client, because `league_sessions` is
-- readable only by members and the whole point of this function is to answer for
-- leagues you are not in yet.
--
-- Dropped first, not replaced. `create or replace function` refuses to change a
-- function's return type — "cannot change return type of existing function ... Row
-- type defined by OUT parameters is different" — and adding a column to a
-- `returns table` is exactly that.
drop function if exists public.public_leagues();

create function public.public_leagues()
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
    upcoming.location_detail,
    upcoming.latitude,
    upcoming.longitude
  from public.leagues l
  cross join lateral (
    select count(*) as member_count
    from public.league_members lm
    where lm.league_id = l.id
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

-- The function was dropped and recreated, so it is new as far as Postgres is
-- concerned: it gets a fresh EXECUTE grant to PUBLIC, and `anon` inherits it.
-- Unlike a plain body change, these lines are load-bearing rather than a
-- re-assertion. Fifth time — see 20260806010530, 20260808174717, 20260808174941,
-- 20260815061500 and 20260815193000.
revoke all on function public.public_leagues() from public, anon;
grant execute on function public.public_leagues() to authenticated;
