-- Score entry, per docs/PRD.md ("the host or scorekeeper enters each player's
-- final score", and the host may later correct mistakes).

-- The initial schema let each member update only their own row, with a comment
-- admitting it was a placeholder for host-only scoring. That is the opposite of
-- what the PRD asks for: the host records everyone's score, and no member
-- should be able to quietly revise their own after the fact.
drop policy if exists "Participants can update scores." on public.match_players;

create policy "Hosts can score their own matches."
  on public.match_players for update
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_players.match_id
        and m.host_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_players.match_id
        and m.host_id = (select auth.uid())
    )
  );

-- Recording a card is one action: every seat gets a score and the match closes.
-- Done as a function so a failure cannot leave half the table scored, and so
-- the "all seats accounted for" rule holds no matter which client calls it.
create or replace function public.enter_match_scores(p_match_id uuid, p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  match_host uuid;
  match_status text;
  seated integer;
  supplied integer;
  unmatched integer;
begin
  select m.host_id, m.status into match_host, match_status
    from public.matches m
    where m.id = p_match_id
    for update;

  if match_host is null then
    raise exception 'Match not found.';
  end if;

  if match_host is distinct from caller then
    raise exception 'Only the host can enter scores.';
  end if;

  if match_status = 'canceled' then
    raise exception 'This match was canceled.';
  end if;

  select count(*) into seated
    from public.match_players mp
    where mp.match_id = p_match_id;

  select count(*) into supplied
    from jsonb_array_elements(p_scores);

  -- Every seat must be accounted for, so a partial card cannot close a match
  -- and quietly leave someone on zero in the standings.
  if supplied <> seated then
    raise exception 'Expected % scores, got %.', seated, supplied;
  end if;

  select count(*) into unmatched
    from jsonb_array_elements(p_scores) as entry
    where not exists (
      select 1 from public.match_players mp
      where mp.match_id = p_match_id
        and mp.player_id = (entry ->> 'player_id')::uuid
    );

  if unmatched > 0 then
    raise exception 'Scores submitted for % players who are not seated.', unmatched;
  end if;

  update public.match_players mp
    set score = (entry ->> 'score')::integer
    from jsonb_array_elements(p_scores) as entry
    where mp.match_id = p_match_id
      and mp.player_id = (entry ->> 'player_id')::uuid;

  update public.matches
    set status = 'completed'
    where id = p_match_id;
end;
$$;

revoke all on function public.enter_match_scores(uuid, jsonb) from public;
grant execute on function public.enter_match_scores(uuid, jsonb) to authenticated;
