-- Opening a short table to somebody outside the league.
--
-- Browse deliberately excludes league matches: seats there are dealt rather than
-- claimed, so a Join button on one would be a lie, and the insert policy on
-- `match_players` agrees — a seat is allowed when the match has no league or the
-- caller is a member of it. A sub is precisely somebody who is neither, so both
-- of those have to make an exception, and the exception is this flag.
--
-- Set by the organizer rather than inferred from a seat count. A table of three is
-- normal: the draw deals round-robin, so six members become two tables of three
-- and nobody is missing. Only a person can tell the difference between a table
-- that is short and a table that is simply that size.
alter table public.matches
  add column if not exists needs_sub boolean not null default false;

comment on column public.matches.needs_sub is
  'Set by a league organizer to offer this table''s empty seats to non-members. Ignored for matches with no league, which are open to everyone anyway.';

-- The one clause that lets a stranger sit down. Recreated rather than altered
-- because a policy''s expression cannot be changed in place.
drop policy if exists "Users can take a seat they are entitled to." on public.match_players;

create policy "Users can take a seat they are entitled to."
  on public.match_players for insert
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1
      from public.matches m
      where m.id = match_players.match_id
        and (
          m.league_id is null
          or public.is_league_member(m.league_id)
          -- Capacity is still the seat trigger's business, and a full table
          -- refuses a sub exactly as it refuses a member.
          or m.needs_sub
        )
    )
  );

-- Opening a meetup's short tables, in one action.
--
-- Per meetup rather than per table because that is how the shortfall is felt —
-- "we are two down this week" — and because the organizer has no per-table view to
-- act in. Only tables with an empty chair are offered: flagging a full one would
-- put a table in Browse that nobody can join.
--
-- `security definer` for the usual reason: the update policy on `matches` is
-- host-only, and the host of a drawn table is whoever was dealt first.
create or replace function public.open_session_to_subs(
  p_session_id uuid,
  p_open boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league uuid;
  v_seats integer := public.match_seat_limit();
  v_flagged integer;
begin
  select s.league_id
    into v_league
  from public.league_sessions ls
  join public.seasons s on s.id = ls.season_id
  where ls.id = p_session_id;

  if v_league is null then
    raise exception 'That meetup no longer exists.';
  end if;

  if not public.is_league_organizer(v_league) then
    raise exception 'Only an organizer can ask for subs.';
  end if;

  if p_open then
    update public.matches m
    set needs_sub = true
    where m.session_id = p_session_id
      and m.status in ('open', 'full')
      and (select count(*) from public.match_players mp where mp.match_id = m.id) < v_seats;
  else
    -- Closing clears every table in the meetup, including any that filled up in
    -- the meantime, so "we are covered" needs one tap rather than one per table.
    update public.matches m
    set needs_sub = false
    where m.session_id = p_session_id;
  end if;

  get diagnostics v_flagged = row_count;
  return v_flagged;
end;
$$;

revoke all on function public.open_session_to_subs(uuid, boolean) from public, anon;
grant execute on function public.open_session_to_subs(uuid, boolean) to authenticated;
