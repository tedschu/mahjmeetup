-- Three numbers, not two.
--
-- Going is the default in the interface, which keeps answering cheap, but it means
-- "in" alone cannot tell an organizer whether nine people are coming or whether
-- seven are coming and two have not opened the app. That is exactly the difference
-- they need before deciding to bring in a stranger, so the count that is missing —
-- nobody has said — is carried on its own rather than folded into the good news.
create or replace view public.session_attendance_summary
with (security_invoker = true) as
select
  ls.id as session_id,
  -- Closed accounts are excluded here for the same reason the draw skips them:
  -- their membership row survives to keep their results in the standings, but
  -- they are not a person who might turn up.
  count(lm.profile_id)::int as roster,
  count(*) filter (where sa.status = 'out')::int as not_going,
  count(*) filter (where sa.status = 'in')::int as going,
  count(*) filter (where sa.status is null)::int as no_answer,
  -- What the draw would produce if it ran now, so the organizer sees the
  -- consequence rather than having to divide by four in their head. Somebody who
  -- has not answered is counted as coming: it is the assumption the draw makes,
  -- and the number beside it says how solid that assumption is.
  greatest(
    0,
    ceil((count(lm.profile_id) - count(*) filter (where sa.status = 'out'))::numeric
         / public.match_seat_limit())
  )::int as expected_tables
from public.league_sessions ls
join public.seasons s on s.id = ls.season_id
join public.league_members lm on lm.league_id = s.league_id
join public.profiles p on p.id = lm.profile_id and p.deleted_at is null
left join public.session_attendance sa
  on sa.session_id = ls.id and sa.profile_id = lm.profile_id
group by ls.id;

-- security_invoker, so a member sees this only for leagues whose sessions their
-- own policies already let them read. The view adds no reach of its own.
grant select on public.session_attendance_summary to authenticated;
