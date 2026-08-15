-- Correcting an assumption in 20260815214500.
--
-- That migration created `profile_contacts` and granted select, insert and update
-- to `authenticated`, with a comment claiming the table was "not granted to anon".
-- It was. Supabase ships an `alter default privileges in schema public grant all on
-- tables to anon, authenticated, service_role`, so a new table in `public` arrives
-- with full DML already granted to both roles — including DELETE and TRUNCATE — and
-- the explicit grant added nothing.
--
-- The rows were never actually exposed: RLS is enabled and the only policy is
-- `profile_id = auth.uid()`, which matches nothing for a signed-out caller. Anon
-- selects return an empty array, which is what verification against production
-- showed. But that leaves one mechanism between a table of phone numbers and the
-- open internet, and the whole reason this table exists is that the previous
-- arrangement rested on a policy nobody re-read.
--
-- So the grants are made to say what was intended. This is defence in depth rather
-- than a fix for a live hole.
revoke all on public.profile_contacts from anon;

-- Precisely what the profile screen does, and nothing else. No DELETE: clearing the
-- field writes a null, and a member removing their own row would leave the upsert
-- to recreate it for no gain. No TRUNCATE, which nothing should ever want.
revoke all on public.profile_contacts from authenticated;
grant select, insert, update on public.profile_contacts to authenticated;

comment on table public.profile_contacts is
  'Contact details a member has chosen to give. Readable only by the member themselves, by grant and by RLS both; co-players reach them through match_host_contact() and league_organizer_contact().';
