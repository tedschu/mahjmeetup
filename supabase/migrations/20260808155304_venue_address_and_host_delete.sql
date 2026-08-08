-- Split a venue into the name and the address, and let a host remove a match.

-- The venue autocomplete gets a place back from Google as two parts already: a
-- name and an address. Joining them to store one string forced the card title to
-- carry the whole thing — "Geneva Public Library District, South 7th Street,
-- Geneva, IL, USA" — and the split is not reliably recoverable afterwards,
-- because a venue name can itself contain a comma. So keep both parts.
--
-- Nullable, and the card falls back to showing the name alone: a venue typed by
-- hand has no address, and "Ted's house" needs to stay a complete answer.
alter table public.matches
  add column if not exists location_detail text;

-- One-time repair of rows written before the column existed. Splitting at the
-- first comma is exactly right for a Places string, and a no-op for a name typed
-- by hand, which every other existing row is.
--
-- Both expressions see the pre-update row, so location_detail is derived from the
-- full original string rather than from the name this statement just trimmed it to.
update public.matches
set
  location = split_part(location, ', ', 1),
  location_detail = nullif(substring(location from position(', ' in location) + 2), '')
where location_detail is null
  and position(', ' in location) > 0;

-- Nothing could ever delete a match. With RLS enabled and no delete policy every
-- attempt was silently refused, and DELETE was never granted to the API roles
-- either, so it failed twice over. A host needs to be able to call off a match
-- they created.
--
-- Seats go with the match: match_players.match_id is ON DELETE CASCADE, and
-- referential actions are not subject to the other table's RLS.
grant delete on public.matches to authenticated;

create policy "Hosts can delete their matches."
  on public.matches for delete
  using (auth.uid() = host_id);
