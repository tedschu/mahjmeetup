-- Saying "not this one", including after the tables have been drawn.
--
-- Writing the attendance row is something a member can do through RLS on their
-- own. The reason this is a function — and a `security definer` one — is the
-- second half: once a meetup is drawn, dropping out has to give the seat up too,
-- or the table still shows four people and the organizer never learns they are
-- short. Vacating that seat means touching a `matches` row whose host is somebody
-- else, which the host-only update policy on `matches` refuses.
--
-- Returns how many tables the member was seated at and has now left, so the screen
-- can say what actually happened rather than assuming.
create or replace function public.set_session_attendance(
  p_session_id uuid,
  p_status text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
  v_league uuid;
  v_left integer := 0;
  v_match record;
  v_heir uuid;
begin
  if v_caller is null then
    raise exception 'Sign in first.';
  end if;

  if p_status not in ('in', 'out') then
    raise exception 'Attendance must be in or out.';
  end if;

  select s.league_id
    into v_league
  from public.league_sessions ls
  join public.seasons s on s.id = ls.season_id
  where ls.id = p_session_id;

  if v_league is null then
    raise exception 'That meetup no longer exists.';
  end if;

  -- Members only, and only for themselves. Both halves matter: this function
  -- writes past RLS, so the checks the policies would have made are made here.
  if not public.is_league_member(v_league) then
    raise exception 'Only members of this league can answer for its meetups.';
  end if;

  insert into public.session_attendance (session_id, profile_id, status, updated_at)
  values (p_session_id, v_caller, p_status, timezone('utc'::text, now()))
  on conflict (session_id, profile_id)
  do update set status = excluded.status, updated_at = excluded.updated_at;

  if p_status = 'in' then
    -- Deliberately not re-seated. The draw decides who sits where, and quietly
    -- adding somebody back to a table of four would overfill it; coming back
    -- before the draw needs nothing, and after it the organizer redraws.
    return 0;
  end if;

  for v_match in
    select m.id, m.host_id
    from public.matches m
    join public.match_players mp on mp.match_id = m.id
    where m.session_id = p_session_id
      and mp.player_id = v_caller
      and m.status in ('open', 'full')
  loop
    delete from public.match_players
    where match_id = v_match.id and player_id = v_caller;

    v_left := v_left + 1;

    if v_match.host_id = v_caller then
      -- The host of a drawn table is only whoever was dealt first, so handing it
      -- on is no demotion. Longest-seated of those left, matching how a closed
      -- account passes its matches on.
      select mp.player_id
        into v_heir
      from public.match_players mp
      where mp.match_id = v_match.id
      order by mp.joined_at
      limit 1;

      if v_heir is null then
        -- Nobody left to hand it to. An empty table is not a table.
        delete from public.matches where id = v_match.id;
      else
        update public.matches set host_id = v_heir where id = v_match.id;
      end if;
    end if;
  end loop;

  return v_left;
end;
$$;

revoke all on function public.set_session_attendance(uuid, text) from public, anon;
grant execute on function public.set_session_attendance(uuid, text) to authenticated;
