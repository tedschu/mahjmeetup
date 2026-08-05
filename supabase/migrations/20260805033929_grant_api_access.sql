-- Expose the initial schema's tables to the Data API roles.
--
-- Supabase no longer auto-exposes new tables in `public` to `anon` /
-- `authenticated`, so tables need explicit GRANTs even when RLS policies are in
-- place. Without these, every PostgREST request fails with
-- "permission denied for table ...". RLS still governs which *rows* each role
-- can touch; these grants only govern which *operations* reach RLS at all.

-- profiles: anyone can read the member directory; members manage their own row.
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

-- matches: anyone can browse; members create matches and hosts edit their own.
grant select on public.matches to anon, authenticated;
grant insert, update on public.matches to authenticated;

-- match_players: anyone can see who is seated; members join, leave, and score.
grant select on public.match_players to anon, authenticated;
grant insert, update, delete on public.match_players to authenticated;
