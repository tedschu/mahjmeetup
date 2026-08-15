-- Nothing stopped a stranger taking a seat in a league match.
--
-- "Users can join matches" checked only that you were seating yourself, and
-- `matches` is readable by everyone, so any signed-in member holding a league
-- match's id could insert themselves into a league they do not belong to. No
-- screen offers this — Browse lists only pick-up games — but the API does, and
-- the ids are not secret, so the guard belongs in the policy rather than in the
-- set of things the UI happens not to ask for.
--
-- Two conditions now: the seat is yours, and the match is either a pick-up game
-- or one belonging to a league you are in.
drop policy if exists "Users can join matches." on public.match_players;

create policy "Users can take a seat they are entitled to."
  on public.match_players for insert
  with check (
    player_id = (select auth.uid())
    and exists (
      select 1
      from public.matches m
      where m.id = match_players.match_id
        and (m.league_id is null or public.is_league_member(m.league_id))
    )
  );

-- Unaffected: draw_league_session is security definer and runs as the owner, so
-- it still seats a whole table at once, and the trigger that seats a host runs in
-- the same way. Both are the paths a league seat is *supposed* to arrive by.
--
-- Not addressed here, deliberately: a member of a league can still in principle
-- insert an extra seat into one of their own league's tables, outside the draw.
-- Browse offers no Join on league matches for exactly that reason — an extra
-- player would break the pairing the draw produced — but the database does not
-- forbid it, and making it do so means deciding what should happen when a table
-- is short a player, which is a scheduling question rather than a policy one.
