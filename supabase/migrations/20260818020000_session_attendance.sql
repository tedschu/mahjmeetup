-- Who is coming to which meetup.
--
-- The draw dealt every member of the league every time, so a season where two
-- people were away still produced tables seating them: an empty chair nobody had
-- declared, discovered on the night. There was nowhere in the schema to say "not
-- this one" — leaving the table afterwards was the only vocabulary, and that is a
-- statement about a table rather than about an evening.
--
-- Attendance attaches to the meetup rather than to a match because it has to exist
-- *before* there is anything to be seated at. That ordering is the whole point: a
-- league that knows two people are out draws three tables of three and never needs
-- a stranger. Subs are then only for somebody dropping out after the draw, which is
-- a far smaller problem than the one it looked like.
create table if not exists public.session_attendance (
  session_id uuid references public.league_sessions(id) on delete cascade not null,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  -- Two states, and no third for "maybe". An organizer deciding whether to find a
  -- fourth cannot act on a maybe, and offering one mostly collects them.
  status text not null check (status in ('in', 'out')),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (session_id, profile_id)
);

create index if not exists session_attendance_profile_idx
  on public.session_attendance (profile_id);

alter table public.session_attendance enable row level security;

-- Absence of a row is "has not answered", deliberately, rather than a row seeded
-- for every member at draw time. It is the honest default — nobody has said
-- anything — and it means adding a member mid-season needs no backfill.
create policy "Members can see who is coming."
  on public.session_attendance for select
  using (
    exists (
      select 1
      from public.league_sessions ls
      join public.seasons s on s.id = ls.season_id
      where ls.id = session_attendance.session_id
        and public.is_league_member(s.league_id)
    )
  );

-- Answering for somebody else is the one thing this table must never allow: an
-- organizer who could mark a member out could quietly drop them from the draw.
create policy "Members answer for themselves."
  on public.session_attendance for all
  using (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.league_sessions ls
      join public.seasons s on s.id = ls.season_id
      where ls.id = session_attendance.session_id
        and public.is_league_member(s.league_id)
    )
  )
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.league_sessions ls
      join public.seasons s on s.id = ls.season_id
      where ls.id = session_attendance.session_id
        and public.is_league_member(s.league_id)
    )
  );

-- Supabase's default privileges hand every new table in `public` to anon and
-- authenticated with full DML. RLS would refuse an anonymous caller anyway, but
-- the grant is what should say so first.
revoke all on public.session_attendance from anon;
revoke all on public.session_attendance from authenticated;
grant select, insert, update, delete on public.session_attendance to authenticated;

comment on table public.session_attendance is
  'Per-meetup availability. No row means the member has not answered, which is counted separately from going and not going.';
