-- Keep signed-out callers out of the league tables.
--
-- The leagues migration granted only `authenticated`, and locally that is what
-- happened: an anonymous request gets "permission denied for table leagues".
-- On the remote project the same request returns an empty array instead, because
-- the deprecated "auto-expose new entities" setting is still switched on there
-- and re-granted every new table, view and function after the fact.
--
-- This is the third time that setting has quietly undone an intentional grant —
-- see 20260806010530, which does the same for score entry. Supabase removes it on
-- 2026-10-30; until then, every migration that adds an entity has to revoke
-- explicitly rather than rely on the default.
--
-- Nothing was exposed. RLS still filtered every row: is_league_member returns
-- false for a null auth.uid(), so an anonymous caller saw zero leagues. But the
-- guard should be the grant as well as the policy, and local and remote should
-- not disagree about who can reach the table at all.
revoke all on public.leagues from anon;
revoke all on public.league_members from anon;
revoke all on public.seasons from anon;
revoke all on public.league_sessions from anon;
revoke all on public.league_standings from anon;

-- Harmless individually — one mints a throwaway string, the other answers false
-- for a caller with no identity — but neither has any business being reachable
-- without a session, and both cost the project CPU to answer.
revoke all on function public.new_invite_token() from anon;
revoke all on function public.is_league_member(uuid) from anon;
revoke all on function public.is_league_organizer(uuid) from anon;

-- Re-stated rather than assumed: these were revoked when they were created, and
-- held on the remote project, but saying so here keeps the intent in one place.
revoke all on function public.join_league_with_token(text) from anon;
revoke all on function public.draw_league_session(uuid) from anon;
