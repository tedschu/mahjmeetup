-- Faces in the all-matches standings.
--
-- `league_standings` has carried `avatar_url` since leagues shipped; `leaderboard`
-- never did. So the same member had a photo on one chip of the Ranking screen and
-- two grey initials on the other, and the screen looked like avatars were broken
-- rather than absent. The client asked for a column the view did not select, which
-- reads as `undefined` and falls through to initials silently.
--
-- Appended after `deleted` rather than set next to `name` where it belongs: `create
-- or replace view` will not rename or reorder existing columns, and dropping the
-- view to get a tidier ordering would take its grants with it. Column order in a
-- view nobody reads by position is not worth that.
--
-- Exposes nothing new. `avatar_url` is a plain column of `public.profiles`, which is
-- granted to `anon` under a `using (true)` policy — so any caller that can already
-- read this view's `name` could read the photo URL directly. Contact details are not
-- here; they live in `profile_contacts`, which anon cannot touch at all.
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
  round(avg(placed.placement), 2) as average_placement,
  (p.deleted_at is not null) as deleted,
  -- Closed accounts have this nulled by delete_my_account(), so a deleted member
  -- keeps their results and shows the initials of their generated label.
  p.avatar_url
from public.profiles p
left join placed on placed.player_id = p.id
group by p.id, p.name, p.deleted_at, p.avatar_url
having p.deleted_at is null or count(placed.match_id) > 0;

grant select on public.leaderboard to anon, authenticated;
