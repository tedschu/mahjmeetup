-- Creating a league from the app failed outright.
--
-- The select policy was membership-only, and membership is granted by an AFTER
-- INSERT trigger. `insert ... returning` computes its output during the insert,
-- before that trigger runs, so the creator could not see the row they had just
-- written and PostgREST reported the whole statement as an RLS violation. The
-- insert alone returned 201; the same insert asking for the row back returned
-- 42501, which is why this hid behind seeded data — nothing had ever created a
-- league through the client.
--
-- Naming the creator directly fixes it, and is right on its own terms: whoever
-- made a league should be able to see it even if they are somehow not on its
-- roster.
drop policy if exists "Members can see their leagues." on public.leagues;

create policy "Members and the creator can see a league."
  on public.leagues for select
  using (public.is_league_member(id) or created_by = (select auth.uid()));
