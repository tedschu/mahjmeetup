-- The other direction: letting a host reach the people who joined.
--
-- 20260815214500 gave players the host's address. The reverse is at least as
-- necessary and was missing — the host is the one with things to announce, because
-- they are the one who moves a match, loses a venue, or finds the buzzer broken.
-- There is no messaging in this app, so the answer is to hand a prefilled message
-- to whatever mail client the host already uses.
--
-- Which means the app needs the addresses. That is a real widening of who sees
-- what, so it is scoped the same way and no wider:
--
--   * the host of a match sees the addresses of people seated at that match
--   * the organizer of a league sees the addresses of that league's members
--
-- Nobody else, and not the other way around: a player still cannot enumerate the
-- other players. The client puts these in BCC so the recipients do not see each
-- other either; the host inevitably sees them in their own compose window, which
-- is why the profile screen now says so.
--
-- Only name and email. Phone numbers are not needed to compose an email, and
-- handing over a list of them would be a wider disclosure for no benefit.

-- Seated players, for the host of the match.
--
-- The host's own row is excluded: they are the one writing, and the client puts
-- their address in the To field so they keep a copy anyway.
--
-- No rows when the caller is not the host, rather than an error — the UI only shows
-- the button to a host, so an empty answer means a stale screen and the button
-- simply does nothing rather than raising at them.
create or replace function public.match_player_contacts(p_match_id uuid)
returns table (name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, u.email::text
  from public.matches m
  join public.match_players mp on mp.match_id = m.id
  join public.profiles p on p.id = mp.player_id
  join auth.users u on u.id = mp.player_id
  where m.id = p_match_id
    and m.host_id = (select auth.uid())
    and mp.player_id <> (select auth.uid())
  order by p.name;
$$;

-- League members, for the organizer. `is_league_organizer` is the same predicate
-- the update and draw paths already use, so there is one definition of "runs this
-- league" rather than two that can drift.
create or replace function public.league_member_contacts(p_league_id uuid)
returns table (name text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, u.email::text
  from public.league_members lm
  join public.profiles p on p.id = lm.profile_id
  join auth.users u on u.id = lm.profile_id
  where lm.league_id = p_league_id
    and public.is_league_organizer(p_league_id)
    and lm.profile_id <> (select auth.uid())
  order by p.name;
$$;

-- New functions returning email addresses, so the PUBLIC-inherits-to-anon trap
-- matters here as much as anywhere. Seventh time — see 20260806010530,
-- 20260808174717, 20260808174941, 20260815061500, 20260815193000, 20260815210000
-- and 20260815214500.
revoke all on function public.match_player_contacts(uuid) from public, anon;
revoke all on function public.league_member_contacts(uuid) from public, anon;
grant execute on function public.match_player_contacts(uuid) to authenticated;
grant execute on function public.league_member_contacts(uuid) to authenticated;

comment on function public.match_player_contacts(uuid) is
  'Names and emails of players seated at a match, for its host only, excluding the host. No rows otherwise.';
comment on function public.league_member_contacts(uuid) is
  'Names and emails of a league''s members, for its organizer only, excluding the organizer. No rows otherwise.';
