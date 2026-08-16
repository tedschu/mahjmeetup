-- Closing an account, without erasing everyone else's season.
--
-- There was no way to leave. The profile screen could edit a name and a phone
-- number but not remove either, and the only route out was asking someone with
-- database access — which is not a route.
--
-- The obvious implementation is `delete from auth.users`, and it is wrong twice
-- over. It does not work, and it would destroy other people's records if it did:
--
--   1. `profiles_id_fkey` is ON DELETE NO ACTION, so deleting the user raises
--      "update or delete on table users violates foreign key constraint
--      profiles_id_fkey" while any profile row stands.
--   2. `match_players.player_id` and `league_members.profile_id` are ON DELETE
--      CASCADE from `profiles`. So a delete that got past (1) by removing the
--      profile would take every seat, every score, and every league membership
--      with it — silently rewriting the leaderboard and the standings of leagues
--      the departing member merely played in. A won tournament would vanish from
--      the record of the people who came second.
--
-- So the account is deleted and the record is kept: the auth user goes, the
-- profile stays as a tombstone with nothing personal in it, and everything that
-- points at that profile keeps pointing at it. The leaderboard still shows the
-- games, now played by "Player 3f2a" rather than by a name.
--
-- The tradeoff, stated plainly: the games someone played are not theirs alone to
-- erase. They are entries in a shared standings table, the same way a name on a
-- tournament bracket is. What is theirs is the identity attached to those games,
-- and that is what this removes — name, email, phone, photo, town, home
-- coordinates. Nothing that survives identifies a person.

-- --------------------------------------------------------------------------
-- The tombstone marker.
alter table public.profiles
  -- Null means a live member. A timestamp rather than a boolean for the same
  -- reason as `leagues.archived_at`: "when" is the next question, and it is free.
  add column deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'When this member closed their account, or null while it is live. A deleted profile is a tombstone: it keeps its id so scores and standings still resolve, and carries no personal details.';

-- --------------------------------------------------------------------------
-- Letting a profile outlive its auth user.
--
-- This is the constraint that makes the whole approach possible, and dropping it
-- deserves the paragraph. `profiles.id` referenced `auth.users` with no delete
-- action, which is what made "delete the user, keep the profile" impossible.
--
-- Dropping it does not open a way to fabricate profiles. The insert policy on
-- this table is `auth.uid() = id`, so a client can still only ever create the
-- profile belonging to the caller, and `handle_new_user` creates it from the
-- authenticated user anyway. What the constraint enforced, the policy already
-- enforces for every path a client can take; only migrations and definer
-- functions could now insert an id that is not a real user, and they could
-- always do worse than that.
--
-- What is lost is the guarantee in the other direction: a `profiles` row no
-- longer proves a live user exists. That is exactly the state a tombstone is.
-- Code that needs "is this a real, reachable member" must test `deleted_at`,
-- which is why the functions below now do.
alter table public.profiles
  drop constraint profiles_id_fkey;

-- --------------------------------------------------------------------------
-- The generic identity a tombstone wears.
--
-- Derived from the profile id rather than random, so it is stable: the same
-- deleted player is "Player 3f2a" on the leaderboard, in a league's standings and
-- in the roster of a match from last spring, instead of a different label in each.
-- Four hex characters is not unique across a large table and is not meant to be —
-- it is a label, not a key, and two "Player 3f2a"s are no more confusing than two
-- people called Sarah.
create or replace function public.anonymous_player_name(p_profile_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Player ' || substr(replace(p_profile_id::text, '-', ''), 1, 4);
$$;

comment on function public.anonymous_player_name(uuid) is
  'The generic label a deleted member is shown under. Derived from the id so it is stable across every screen.';

-- --------------------------------------------------------------------------
-- Close my own account.
--
-- Takes no arguments on purpose. The account it deletes is `auth.uid()` and there
-- is no way to name another one, so this cannot be turned into a weapon by
-- guessing a uuid — the usual failure mode of a definer function that accepts an
-- id and then checks it.
--
-- Definer because it has to reach `auth.users`, which no client role can touch,
-- and because the cleanup below writes rows belonging to other people's matches.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_match record;
  v_league record;
  v_successor uuid;
begin
  if v_caller is null then
    raise exception 'You must be signed in to close your account.';
  end if;

  -- ----------------------------------------------------------------------
  -- Matches they are hosting that have not happened yet.
  --
  -- A tombstone cannot host: nothing it owns can be edited, moved or scored,
  -- because there is no longer anyone who satisfies `auth.uid() = host_id`. So a
  -- future match must be handed over or called off before the account goes.
  --
  -- Handed to the longest-seated other player, rather than canceled. They already
  -- said they were coming, so the game survives someone leaving — and cancelling
  -- would delete three other people's Saturday to tidy up one person's exit. It
  -- is the same rule the league draw already uses when it needs a host: the first
  -- player at the table takes it.
  for v_match in
    select m.id
    from public.matches m
    where m.host_id = v_caller
      and m.status in ('open', 'full')
      and m.date_time > timezone('utc'::text, now())
  loop
    select mp.player_id into v_successor
    from public.match_players mp
    join public.profiles p on p.id = mp.player_id
    where mp.match_id = v_match.id
      and mp.player_id <> v_caller
      and p.deleted_at is null
    order by mp.joined_at
    limit 1;

    if v_successor is not null then
      update public.matches set host_id = v_successor where id = v_match.id;
    else
      -- Nobody else was coming, so there is no game to save. `match_players`
      -- goes with it by cascade.
      delete from public.matches where id = v_match.id;
    end if;
  end loop;

  -- Seats at future matches, including ones just handed on. They are not coming,
  -- and leaving the seat filled would hold a place at a table someone else could
  -- take. Seats at matches already played are left exactly where they are — those
  -- are the record.
  delete from public.match_players mp
  using public.matches m
  where mp.match_id = m.id
    and mp.player_id = v_caller
    and m.status in ('open', 'full')
    and m.date_time > timezone('utc'::text, now());

  -- ----------------------------------------------------------------------
  -- Leagues they organize.
  --
  -- A league whose only organizer has left is a league nobody can run: no draw,
  -- no edits, no new seasons, and no way to promote anyone, because promoting
  -- requires being an organizer. Succession has to happen here.
  for v_league in
    select lm.league_id
    from public.league_members lm
    where lm.profile_id = v_caller
      and lm.role = 'organizer'
  loop
    -- Someone else already runs it too, so there is nothing to arrange.
    if exists (
      select 1
      from public.league_members lm
      join public.profiles p on p.id = lm.profile_id
      where lm.league_id = v_league.league_id
        and lm.role = 'organizer'
        and lm.profile_id <> v_caller
        and p.deleted_at is null
    ) then
      continue;
    end if;

    select lm.profile_id into v_successor
    from public.league_members lm
    join public.profiles p on p.id = lm.profile_id
    where lm.league_id = v_league.league_id
      and lm.profile_id <> v_caller
      and p.deleted_at is null
    order by lm.joined_at
    limit 1;

    if v_successor is not null then
      update public.league_members
      set role = 'organizer'
      where league_id = v_league.league_id and profile_id = v_successor;
    else
      -- Nobody is left in it. Archived rather than deleted: archiving keeps the
      -- seasons, tables and scores that `delete_league` would destroy, and the
      -- whole point of this function is that closing an account does not erase
      -- games. It also stops the league being listed or joinable, which is the
      -- part that actually matters once it is empty.
      update public.leagues
      set archived_at = timezone('utc'::text, now())
      where id = v_league.league_id and archived_at is null;
    end if;
  end loop;

  -- Their league memberships are deliberately NOT removed. Standings are built
  -- from `league_members` joined to scores, so deleting the row would erase the
  -- member's results from a league other people are still playing in. The draw
  -- and the seat counts skip deleted members instead — see the functions below.

  -- ----------------------------------------------------------------------
  -- The personal details.
  --
  -- Everything identifying, cleared in one statement. `deleted_at` is set in the
  -- same update so there is no window in which a scrubbed profile looks like a
  -- live member with a blank name.
  update public.profiles
  set
    name = public.anonymous_player_name(v_caller),
    town = null,
    experience_level = null,
    avatar_url = null,
    home_latitude = null,
    home_longitude = null,
    deleted_at = timezone('utc'::text, now())
  where id = v_caller;

  -- The phone number. Deleted outright rather than nulled, so nothing is left
  -- keyed to this member in a table whose only purpose is contact details.
  delete from public.profile_contacts where profile_id = v_caller;

  -- ----------------------------------------------------------------------
  -- The auth user, which is where the email address lives.
  --
  -- Most of GoTrue's tables reference `auth.users` ON DELETE CASCADE, so sessions,
  -- identities, MFA factors, one-time tokens and webauthn credentials go with this
  -- row. Two do not, and were found by checking rather than by assuming:
  -- `auth.refresh_tokens.user_id` and `auth.flow_state.user_id` carry the user
  -- with no foreign key at all. Left alone they would be the only surviving trace
  -- of the account — and `refresh_tokens` in particular is a live credential.
  delete from auth.refresh_tokens where user_id = v_caller::text;
  delete from auth.flow_state where user_id = v_caller;
  delete from auth.users where id = v_caller;
end;
$$;

-- Definer, reaches auth.users, and irreversible: exactly the shape where the
-- PUBLIC-inherits-to-anon trap would matter most. Postgres grants EXECUTE on a new
-- function to PUBLIC and `anon` inherits it, so the revoke is load-bearing, not a
-- formality. Eighth time in this project — see 20260806010530, 20260808174717,
-- 20260808174941, 20260815061500, 20260815193000, 20260815210000, 20260815214500
-- and 20260815223000.
--
-- An anonymous caller has no `auth.uid()` and would be refused by the first check
-- anyway. Revoked regardless: "it happens to fail closed" is not the same as "it
-- cannot be called".
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

revoke all on function public.anonymous_player_name(uuid) from public, anon;
grant execute on function public.anonymous_player_name(uuid) to authenticated;

comment on function public.delete_my_account() is
  'Close the caller''s own account: hands on or cancels their future matches, arranges league succession, scrubs their profile to an anonymous tombstone and deletes their auth user. Scores and past matches are kept, attributed to the tombstone.';

-- --------------------------------------------------------------------------
-- A deleted member is not dealt into a draw.
--
-- Their membership row stays so their past results stay in the standings, which
-- means every place that treats `league_members` as "people who will be playing"
-- now has to say so explicitly. This is that list, and it is the reason the
-- membership row was the harder half of this migration.
--
-- Replaced whole; the only change from 20260808163809 is the join to `profiles`.
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
  v_seats integer := public.match_seat_limit();
  v_roster uuid[];
  v_count integer;
  v_tables integer;
  v_seatmates uuid[];
  v_match uuid;
  i integer;
begin
  select se.league_id, ls.date_time, ls.location, ls.location_detail
    into v_league, v_when, v_location, v_detail
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
  -- New: closed accounts are skipped. Their membership row survives so their
  -- results stay in the standings, but dealing them a seat would seat a tombstone
  -- — a table nobody can score, hosted by nobody if they were dealt first.
  select array_agg(lm.profile_id order by random())
    into v_roster
  from public.league_members lm
  join public.profiles p on p.id = lm.profile_id
  where lm.league_id = v_league
    and p.deleted_at is null;

  v_count := coalesce(array_length(v_roster, 1), 0);

  if v_count = 0 then
    raise exception 'This league has no members yet.';
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
      host_id, date_time, location, location_detail, league_id, session_id, table_number, status
    )
    values (v_seatmates[1], v_when, v_location, v_detail, v_league, p_session_id, i, 'open')
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

-- --------------------------------------------------------------------------
-- A deleted member does not occupy a seat in a league's capacity.
--
-- Same reasoning, the other visible consequence: a league of eight that two
-- members have left would otherwise read "full" forever, and refuse the two
-- people who could take those places.
--
-- Dropped and recreated rather than replaced, because the member count is part of
-- the return type and `create or replace function` cannot change one. The grants
-- below are therefore load-bearing again.
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

revoke all on function public.public_leagues() from public, anon;
grant execute on function public.public_leagues() to authenticated;

-- The capacity check that admits people, which has to agree with the count that
-- is displayed or the league reads "2 seats left" and then refuses the next join.
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
    -- Closed accounts do not count against the limit, matching public_leagues().
    select count(*) into v_count
    from public.league_members lm
    join public.profiles p on p.id = lm.profile_id
    where lm.league_id = p_league_id
      and p.deleted_at is null;

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

revoke all on function public.join_public_league(uuid) from public, anon;
grant execute on function public.join_public_league(uuid) to authenticated;

-- --------------------------------------------------------------------------
-- The standings tables learn about tombstones.
--
-- Two changes each, and the second is the one that matters.
--
--   * `deleted` is appended, so a screen can mark the row "(deleted)" rather than
--     presenting "Player 3f2a" as though it were somebody's chosen handle.
--   * a deleted member with no completed games is dropped entirely. Both views
--     list every profile so that a new member appears before their first game,
--     and without this a closed account that never played would sit on the
--     leaderboard forever on nothing but a zero.
--
-- Appended rather than inserted: `create or replace view` keeps existing columns
-- in place and will refuse a reordering.
create or replace view public.leaderboard
with (security_invoker = true) as
with scored as (
  select
    mp.match_id,
    mp.player_id,
    mp.score
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'completed'
    and mp.score is not null
),
placed as (
  select
    scored.*,
    -- rank(), not row_number(): a tied top score is a win for everyone tied.
    rank() over (partition by scored.match_id order by scored.score desc) as placement
  from scored
)
select
  p.id as player_id,
  p.name,
  count(placed.match_id)::int as games_played,
  coalesce(sum(placed.score), 0)::int as total_points,
  round(avg(placed.score), 1) as average_points,
  count(*) filter (where placed.placement = 1)::int as wins,
  round(avg(placed.placement), 2) as average_placement,
  (p.deleted_at is not null) as deleted
from public.profiles p
left join placed on placed.player_id = p.id
group by p.id, p.name, p.deleted_at
having p.deleted_at is null or count(placed.match_id) > 0;

grant select on public.leaderboard to anon, authenticated;

create or replace view public.league_standings
with (security_invoker = true) as
with scored as (
  select
    m.league_id,
    mp.match_id,
    mp.player_id,
    mp.score
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'completed'
    and mp.score is not null
    and m.league_id is not null
),
placed as (
  select
    scored.*,
    rank() over (partition by scored.match_id order by scored.score desc) as placement
  from scored
)
select
  lm.league_id,
  p.id as player_id,
  p.name,
  p.avatar_url,
  count(placed.match_id)::int as games_played,
  coalesce(sum(placed.score), 0)::int as total_points,
  round(avg(placed.score), 1) as average_points,
  count(*) filter (where placed.placement = 1)::int as wins,
  round(avg(placed.placement), 2) as average_placement,
  (p.deleted_at is not null) as deleted
from public.league_members lm
join public.profiles p on p.id = lm.profile_id
left join placed
  on placed.player_id = lm.profile_id
 and placed.league_id = lm.league_id
group by lm.league_id, p.id, p.name, p.avatar_url, p.deleted_at
having p.deleted_at is null or count(placed.match_id) > 0;

grant select on public.league_standings to authenticated;

-- --------------------------------------------------------------------------
-- Nothing to change in the contact functions, and it is worth saying why rather
-- than leaving the next reader to check.
--
-- `match_host_contact`, `league_organizer_contact`, `match_player_contacts` and
-- `league_member_contacts` all inner join `auth.users` to read the email. A closed
-- account has no row there, so it drops out of every one of them automatically.
-- The host section of a match sheet simply does not render, and a group email to a
-- table skips the member who left — which is right on both counts, because there
-- is no address to give.
