-- Leagues: a named, structured competition that owns its matches and standings.
--
-- Shape is League -> Season -> Session -> Table, which is how league software
-- generally models this and maps onto how the group actually plays: a league
-- runs for a season, a season is a handful of meetups, and a meetup seats
-- everyone across as many tables as it takes.
--
-- A match belongs to at most one league. That is a deliberate constraint rather
-- than a junction table: a game counting toward two sets of standings would make
-- "who won the league" ambiguous, and nobody has asked for it.

-- Twelve URL-safe characters from pgcrypto's CSPRNG. The token is the only thing
-- standing between a stranger and a league, so it is not built from random(),
-- which is seeded and predictable.
create or replace function public.new_invite_token()
returns text
language sql
volatile
as $$
  select replace(replace(encode(extensions.gen_random_bytes(9), 'base64'), '/', '_'), '+', '-');
$$;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  -- A token rather than a hex value, so the app owns what each colour looks like
  -- and the palette can change without a data migration.
  color text not null default 'blue'
    check (color in ('blue', 'orange', 'gold', 'green', 'plum', 'teal')),
  created_by uuid references public.profiles(id) not null,
  invite_token text not null unique default public.new_invite_token(),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table public.league_members (
  league_id uuid references public.leagues(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'member' check (role in ('organizer', 'member')),
  joined_at timestamptz not null default timezone('utc'::text, now()),
  primary key (league_id, profile_id)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade not null,
  name text not null check (length(btrim(name)) between 1 and 60),
  status text not null default 'active' check (status in ('active', 'complete')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- One meetup. The tables for it are matches pointing back here, so the date and
-- venue are stored once and every table inherits them.
create table public.league_sessions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete cascade not null,
  sequence integer not null check (sequence > 0),
  date_time timestamptz not null,
  location text not null,
  location_detail text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (season_id, sequence)
);

create index league_members_profile_idx on public.league_members (profile_id);
create index seasons_league_idx on public.seasons (league_id);
create index league_sessions_season_idx on public.league_sessions (season_id);

-- Matches gain their league. `session_id` is set only for tables produced by a
-- draw; a league can also carry a one-off match that is not part of a season.
alter table public.matches
  add column if not exists league_id uuid references public.leagues(id) on delete set null,
  add column if not exists session_id uuid references public.league_sessions(id) on delete cascade,
  add column if not exists table_number integer;

create index matches_league_idx on public.matches (league_id);
create index matches_session_idx on public.matches (session_id);

-- `is_league` only ever said "this counts toward a league" without saying which,
-- so there is nothing here to migrate into league_id. Dropped rather than left
-- as a second, disagreeing source of truth.
alter table public.matches drop column if exists is_league;

-- Membership checks used inside policies, as security definer so they can read
-- league_members without being filtered by that table's own policy. Without
-- this, a policy on league_members that queries league_members recurses.
create or replace function public.is_league_member(p_league uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league and profile_id = (select auth.uid())
  );
$$;

create or replace function public.is_league_organizer(p_league uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league
      and profile_id = (select auth.uid())
      and role = 'organizer'
  );
$$;

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.seasons enable row level security;
alter table public.league_sessions enable row level security;

-- A league is invisible until you are in it. The invite token is therefore the
-- only route in, which is what makes the link meaningful.
create policy "Members can see their leagues."
  on public.leagues for select using (public.is_league_member(id));
create policy "Members can create leagues."
  on public.leagues for insert with check ((select auth.uid()) = created_by);
create policy "Organizers can edit their league."
  on public.leagues for update using (public.is_league_organizer(id));
create policy "Organizers can delete their league."
  on public.leagues for delete using (public.is_league_organizer(id));

create policy "Members can see the roster."
  on public.league_members for select using (public.is_league_member(league_id));
create policy "Organizers can add members."
  on public.league_members for insert with check (public.is_league_organizer(league_id));
create policy "Organizers can change roles."
  on public.league_members for update using (public.is_league_organizer(league_id));
-- Leaving is your own business; an organizer can also remove someone.
create policy "Members can leave, organizers can remove."
  on public.league_members for delete
  using (profile_id = (select auth.uid()) or public.is_league_organizer(league_id));

create policy "Members can see seasons."
  on public.seasons for select using (public.is_league_member(league_id));
create policy "Organizers manage seasons."
  on public.seasons for all using (public.is_league_organizer(league_id))
  with check (public.is_league_organizer(league_id));

create policy "Members can see sessions."
  on public.league_sessions for select
  using (exists (
    select 1 from public.seasons s
    where s.id = league_sessions.season_id and public.is_league_member(s.league_id)
  ));
create policy "Organizers manage sessions."
  on public.league_sessions for all
  using (exists (
    select 1 from public.seasons s
    where s.id = league_sessions.season_id and public.is_league_organizer(s.league_id)
  ))
  with check (exists (
    select 1 from public.seasons s
    where s.id = league_sessions.season_id and public.is_league_organizer(s.league_id)
  ));

grant select, insert, update, delete on public.leagues to authenticated;
grant select, insert, update, delete on public.league_members to authenticated;
grant select, insert, update, delete on public.seasons to authenticated;
grant select, insert, update, delete on public.league_sessions to authenticated;

-- Whoever creates a league organizes it, without a second round trip that could
-- fail and leave a league nobody can administer.
create or replace function public.seat_league_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.league_members (league_id, profile_id, role)
  values (new.id, new.created_by, 'organizer')
  on conflict do nothing;
  return null;
end;
$$;

create trigger seat_league_creator_after_insert
  after insert on public.leagues
  for each row execute function public.seat_league_creator();

-- Joining by link. Security definer because the whole point is to let someone
-- read a league they cannot yet see; the token is the authorisation.
create or replace function public.join_league_with_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target uuid;
begin
  if caller is null then
    raise exception 'You must be signed in to join a league.';
  end if;

  select id into target from public.leagues where invite_token = btrim(p_token);

  if target is null then
    raise exception 'That invite link is not valid.';
  end if;

  insert into public.league_members (league_id, profile_id, role)
  values (target, caller, 'member')
  on conflict (league_id, profile_id) do nothing;

  return target;
end;
$$;

revoke all on function public.join_league_with_token(text) from public, anon;
grant execute on function public.join_league_with_token(text) to authenticated;

-- Draw the tables for a session: shuffle the roster and deal it out.
--
-- Has to be server-side. Seating other people means inserting match_players rows
-- for them, and the "Users can join matches" policy only ever lets a member
-- insert their own seat — a client physically cannot do this.
--
-- Re-running replaces the previous draw, so an organizer can reshuffle before
-- anyone plays. Scores are lost with the matches, which is why it refuses once
-- any table has been played.
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
  select array_agg(profile_id order by random())
    into v_roster
  from public.league_members
  where league_id = v_league;

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

revoke all on function public.draw_league_session(uuid) from public, anon;
grant execute on function public.draw_league_session(uuid) to authenticated;

-- Standings, scoped to a league. Same ranking as the global view: total points,
-- following NMJL practice where accumulated hand values are what rankings are
-- built on. Kept separate rather than adding a column to `leaderboard`, because
-- that view has to keep answering "everyone, all matches".
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
    -- rank(), not row_number(): a tied top score is a win for everyone tied.
    rank() over (partition by scored.match_id order by scored.score desc) as placement
  from scored
)
-- Every member appears, including those yet to play, so a new league reads as a
-- roster rather than an empty list.
select
  lm.league_id,
  p.id as player_id,
  p.name,
  p.avatar_url,
  count(placed.match_id)::int as games_played,
  coalesce(sum(placed.score), 0)::int as total_points,
  round(avg(placed.score), 1) as average_points,
  count(*) filter (where placed.placement = 1)::int as wins,
  round(avg(placed.placement), 2) as average_placement
from public.league_members lm
join public.profiles p on p.id = lm.profile_id
left join placed
  on placed.player_id = lm.profile_id
 and placed.league_id = lm.league_id
group by lm.league_id, p.id, p.name, p.avatar_url;

grant select on public.league_standings to authenticated;
