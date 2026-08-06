-- Contact details the profile in docs/PRD.md asks for.
--
-- Email already lives on auth.users and is not copied here: duplicating it
-- would mean keeping two copies in step, and the signed-in member can read
-- their own from the session.
--
-- Photo is deliberately not added yet. It needs a Storage bucket with its own
-- access policies and an image picker, which is a larger piece than a column.
alter table public.profiles
  add column if not exists phone text;
