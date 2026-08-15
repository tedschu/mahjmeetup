-- Deleting a league has never actually worked, and the reason is worth recording.
--
-- Two referential actions on `matches` fire when a league row goes, and they
-- collide:
--
--   matches_league_id_fkey   ON DELETE SET NULL   (leagues)
--   matches_session_id_fkey  ON DELETE CASCADE    (league_sessions)
--
-- The cascade reaches `matches` through seasons and league_sessions, while the SET
-- NULL reaches the same rows directly. A drawn table is subject to both. When the
-- SET NULL fires as an UPDATE on such a row, Postgres re-validates that row's
-- other foreign keys — including `session_id`, whose session the parallel cascade
-- has already removed. The result:
--
--   ERROR: insert or update on table "matches" violates foreign key constraint
--          "matches_session_id_fkey"
--
-- So any league whose meetups had been drawn simply refused to delete, with an
-- error nobody could act on. The order has to be chosen rather than left to the
-- planner, which means doing it in a function.
--
-- The function is also the right place for the rule the UI was going to enforce on
-- its own: a league stops being one person's to erase once tables have been
-- played, because those scores are in everyone's standings. Archiving is the
-- action for that case, and 20260815193000 added it.
create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_played integer;
begin
  -- Definer, so this check is the only thing standing in for the delete policy
  -- that used to guard the table. Same predicate.
  if not public.is_league_organizer(p_league_id) then
    raise exception 'Only a league organizer can delete it.';
  end if;

  -- Only drawn tables count. A pick-up match somebody merely tagged with the
  -- league survives this whole operation, so its scores are not at risk and
  -- should not block anything.
  select count(*) into v_played
  from public.matches m
  where m.league_id = p_league_id
    and m.session_id is not null
    and m.status = 'completed';

  if v_played > 0 then
    raise exception 'This league has % played %, so it cannot be deleted. Archive it instead.',
      v_played,
      case when v_played = 1 then 'table' else 'tables' end;
  end if;

  -- Step one. Detach the tagged pick-up matches by hand, which is what the SET
  -- NULL action would have done — except now it happens before anything is
  -- cascaded, so there is no half-deleted session for the row check to trip over.
  -- These matches keep their seats, notes and scores and revert to pick-up games.
  update public.matches
  set league_id = null
  where league_id = p_league_id
    and session_id is null;

  -- Step two. Drop the drawn tables outright, ahead of the sessions they point at,
  -- so the cascade has no rows left to reach. `match_players` goes with them.
  delete from public.matches
  where league_id = p_league_id
    and session_id is not null;

  -- Step three. The league, and with it the seasons and meetups by cascade.
  delete from public.leagues where id = p_league_id;
end;
$$;

-- The raw delete path is removed, rather than left beside the function.
--
-- It is not a security hole — it was organizer-only — but it is the path that
-- produces the foreign key error above, and leaving two ways to delete a league
-- where only one works is how this stays broken. With the policy gone, a direct
-- `delete from leagues` matches no rows and changes nothing.
drop policy if exists "Organizers can delete their league." on public.leagues;

revoke all on function public.delete_league(uuid) from public, anon;
grant execute on function public.delete_league(uuid) to authenticated;

comment on function public.delete_league(uuid) is
  'Erase a league, its seasons, meetups and drawn tables. Organizer only, and refused once any table has been played — archive it instead. Matches merely tagged with the league survive as pick-up games.';
