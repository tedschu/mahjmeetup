-- Silence means coming, and the count says so.
--
-- The first version of this view reported `going` as the number of members who had
-- explicitly tapped Going, and carried the rest under `no_answer`. That treats
-- joining a league as saying nothing — but joining a league *is* the commitment.
-- A member who signed up for a season has already said they are coming to its
-- meetups; the only news is when they cannot make one. So the default is not an
-- assumption standing in for an answer, it is the answer, and a count that split
-- it in two was describing a data model rather than a league.
--
-- `going` is therefore everyone not marked out. `confirmed` keeps the narrower
-- number — those who tapped it — for anything that later wants to tell a member
-- who has looked from one who has not. Nothing shows it today, and nothing should
-- show it beside `going` as though the two were rival answers.
create or replace view public.session_attendance_summary
with (security_invoker = true) as
select
  ls.id as session_id,
  -- Closed accounts are excluded for the same reason the draw skips them: their
  -- membership row survives to keep their results in the standings, but they are
  -- not a person who might turn up.
  count(lm.profile_id)::int as roster,
  count(*) filter (where sa.status = 'out')::int as not_going,
  (count(lm.profile_id) - count(*) filter (where sa.status = 'out'))::int as going,
  count(*) filter (where sa.status is null)::int as no_answer,
  greatest(
    0,
    ceil((count(lm.profile_id) - count(*) filter (where sa.status = 'out'))::numeric
         / public.match_seat_limit())
  )::int as expected_tables,
  -- Appended, because `create or replace view` will not reorder or rename the
  -- columns already there — it refuses outright rather than guessing.
  count(*) filter (where sa.status = 'in')::int as confirmed
from public.league_sessions ls
join public.seasons s on s.id = ls.season_id
join public.league_members lm on lm.league_id = s.league_id
join public.profiles p on p.id = lm.profile_id and p.deleted_at is null
left join public.session_attendance sa
  on sa.session_id = ls.id and sa.profile_id = lm.profile_id
group by ls.id;

grant select on public.session_attendance_summary to authenticated;
