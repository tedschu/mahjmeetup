-- Revoking a function from `anon` does nothing on its own.
--
-- Postgres grants EXECUTE on every new function to PUBLIC, and `anon` inherits
-- that, so the previous migration's `revoke ... from anon` left the inherited
-- grant in place: an anonymous caller could still invoke is_league_member and get
-- an answer back. The same lesson as 20260806010530, relearned.
--
-- Revoke from PUBLIC to remove the default, then grant back only to the role that
-- needs it. `authenticated` genuinely does: the RLS policies on the league tables
-- call these, and a policy cannot use a function the querying role may not
-- execute.
revoke all on function public.is_league_member(uuid) from public, anon;
revoke all on function public.is_league_organizer(uuid) from public, anon;
grant execute on function public.is_league_member(uuid) to authenticated;
grant execute on function public.is_league_organizer(uuid) to authenticated;

-- Runs as the default for leagues.invite_token, so whoever inserts a league has to
-- be able to execute it — but nobody signed out does.
revoke all on function public.new_invite_token() from public, anon;
grant execute on function public.new_invite_token() to authenticated;
