-- The single standings table, per docs/PRD.md ("Update one main leaderboard
-- automatically").
--
-- Ranked by total points, which follows American (NMJL) practice where each
-- hand on the card carries a fixed value and accumulated points are what the
-- national Mah Jongg Master Points system ranks on. Games, average, and wins
-- are exposed alongside so the group can change the ranking later by editing
-- this view alone, without touching the app or the stored data.
--
-- Only completed matches with a recorded score count. A match still open, or
-- one where the host has not entered scores yet, contributes nothing.

create or replace view public.leaderboard
with (security_invoker = true) as
with scored as (
  select
    mp.match_id,
    mp.player_id,
    mp.score
  from public.match_players mp
  join public.matches m on m.id = mp.match_id
  where m.status = 'completed'
    and mp.score is not null
),
placed as (
  select
    scored.*,
    -- rank(), not row_number(): a tied top score is a win for everyone tied.
    rank() over (partition by scored.match_id order by scored.score desc) as placement
  from scored
)
select
  p.id as player_id,
  p.name,
  count(placed.match_id)::int as games_played,
  coalesce(sum(placed.score), 0)::int as total_points,
  round(avg(placed.score), 1) as average_points,
  count(*) filter (where placed.placement = 1)::int as wins,
  round(avg(placed.placement), 2) as average_placement
from public.profiles p
left join placed on placed.player_id = p.id
group by p.id, p.name;

grant select on public.leaderboard to anon, authenticated;
