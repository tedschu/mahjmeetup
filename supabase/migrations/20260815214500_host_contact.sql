-- Reaching the person running a match or a league.
--
-- The app has no messaging, so someone who has joined a table has no way to ask
-- which door to use or to say they are running late. The host's email answers
-- that, but it is not something to publish: it is the account identifier, it is
-- usually a personal Gmail, and the host chose to post a match rather than to
-- hand out their address.
--
-- So it is scoped rather than added to the directory. You can see the host's
-- contact details once you are seated at their match, and the organizer's once you
-- are in their league. Not before.
--
-- Email is still not copied into `profiles` — see 20260806033830 for why. These
-- functions read `auth.users` directly, which no client role can do, which is the
-- whole reason they are security definer.

-- --------------------------------------------------------------------------
-- First, a leak to close.
--
-- `profiles` carries `phone`, and its select policy is `using (true)` with SELECT
-- granted to `anon`. That means every member's phone number is readable by anyone
-- at all, signed in or not — one unauthenticated REST call returns the lot. The
-- column was added for the profile screen and the policy was written for names and
-- avatars; nobody intended the combination.
--
-- The policy cannot simply be narrowed, because names and avatars genuinely do need
-- to be widely readable: Browse draws the faces at a table you have not joined.
-- RLS has no column granularity, so the column moves to a table of its own where a
-- row-level rule says exactly the right thing — your contact details are yours.
create table public.profile_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text
);

insert into public.profile_contacts (profile_id, phone)
select id, phone from public.profiles where phone is not null;

alter table public.profiles drop column phone;

alter table public.profile_contacts enable row level security;

-- Your own row, and nothing else. Co-players read these details through the
-- functions below instead, which apply their own test.
create policy "Members manage their own contact details."
  on public.profile_contacts for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- NOTE: this grant does less than it looks like. Supabase's default privileges
-- already grant all DML on new public tables to both `anon` and `authenticated`,
-- so anon arrives with access here too and only RLS keeps it out. Corrected in
-- 20260815234500, which revokes anon properly. Left as written because it ran.
grant select, insert, update on public.profile_contacts to authenticated;

comment on table public.profile_contacts is
  'Contact details a member has chosen to give. Readable only by the member themselves; co-players reach them through match_host_contact() and league_organizer_contact().';

-- --------------------------------------------------------------------------
-- The host of a match you are seated at.
--
-- Returns no rows rather than raising when the caller is not entitled. The UI only
-- asks once it believes you are seated, so an empty result means "not yours to
-- see" and the section simply does not appear — which fails closed without turning
-- a stale list into an error banner.
create or replace function public.match_host_contact(p_match_id uuid)
returns table (name text, email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, u.email::text, c.phone
  from public.matches m
  join public.profiles p on p.id = m.host_id
  join auth.users u on u.id = m.host_id
  left join public.profile_contacts c on c.profile_id = m.host_id
  where m.id = p_match_id
    and (
      -- The host, reading their own details back.
      m.host_id = (select auth.uid())
      -- Or someone who has taken a seat at this table.
      or exists (
        select 1 from public.match_players mp
        where mp.match_id = m.id and mp.player_id = (select auth.uid())
      )
    );
$$;

-- The organizer of a league you are in. Same rule, one step wider: membership
-- rather than a seat, because a league is the thing you joined.
create or replace function public.league_organizer_contact(p_league_id uuid)
returns table (name text, email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.name, u.email::text, c.phone
  from public.league_members lm
  join public.profiles p on p.id = lm.profile_id
  join auth.users u on u.id = lm.profile_id
  left join public.profile_contacts c on c.profile_id = lm.profile_id
  where lm.league_id = p_league_id
    and lm.role = 'organizer'
    and public.is_league_member(p_league_id)
  order by p.name;
$$;

-- Both are new functions, so Postgres has granted EXECUTE to PUBLIC and `anon` has
-- inherited it. These reveal email addresses, so this is the one place that trap
-- would matter most. Sixth time — see 20260806010530, 20260808174717,
-- 20260808174941, 20260815061500, 20260815193000 and 20260815210000.
revoke all on function public.match_host_contact(uuid) from public, anon;
revoke all on function public.league_organizer_contact(uuid) from public, anon;
grant execute on function public.match_host_contact(uuid) to authenticated;
grant execute on function public.league_organizer_contact(uuid) to authenticated;

comment on function public.match_host_contact(uuid) is
  'The host''s name, email and phone, for a caller seated at the match or hosting it. No rows otherwise.';
comment on function public.league_organizer_contact(uuid) is
  'The organizer''s name, email and phone, for a caller who is a member of the league. No rows otherwise.';
