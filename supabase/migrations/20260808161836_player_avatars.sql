-- Show who is coming to a match, with faces rather than a seat count.
--
-- A member's Google photo arrives in their own auth metadata, which only they can
-- read. Showing the other three people at a table therefore means the URL has to
-- live somewhere every member can select from — the profiles row, which already
-- carries the name shown beside it.
--
-- The URL is stored, not the image. Google serves these from a stable CDN, and
-- copying the bytes into Storage would mean a bucket, its policies, and a stale
-- copy of something that updates itself.
alter table public.profiles
  add column if not exists avatar_url text;

-- Capture the photo when the profile is created. Google puts it under
-- `avatar_url`, other providers under `picture`; taking either keeps this from
-- silently returning nothing if the group ever signs in another way.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Backfill the members who signed up before the column existed. Reads
-- auth.users directly, which a migration can do and the app cannot.
update public.profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture'
)
from auth.users u
where u.id = p.id
  and p.avatar_url is null;
