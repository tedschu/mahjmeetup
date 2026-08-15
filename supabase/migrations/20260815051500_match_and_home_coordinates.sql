-- Coordinates, so Browse can default to matches near you.
--
-- A match's venue and a member's town both come from Places autocomplete, which
-- returns a place id but no coordinates — those need a separate Place Details
-- lookup, which the proxy now makes when a suggestion is picked.
--
-- Every column is nullable and stays nullable. Matches proposed before this
-- migration have no coordinates and never will, a member's living room may not
-- be in Places at all, and anyone may decline to say where they live. Browse
-- therefore treats "no coordinates" as "always show", never as "too far" —
-- filtering those out would hide real matches from everyone, which is the exact
-- failure this feature is meant to fix.
alter table public.matches
  add column latitude double precision,
  add column longitude double precision;

alter table public.profiles
  add column home_latitude double precision,
  add column home_longitude double precision;

-- Cheap guards against a transposed pair or a bad parse landing in the table,
-- where it would silently place a match in the ocean.
alter table public.matches
  add constraint matches_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint matches_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  -- One without the other is not a location, and a half-set pair would read as
  -- a real position with a zero in it.
  add constraint matches_coordinates_paired
    check ((latitude is null) = (longitude is null));

alter table public.profiles
  add constraint profiles_home_latitude_range
    check (home_latitude is null or (home_latitude >= -90 and home_latitude <= 90)),
  add constraint profiles_home_longitude_range
    check (home_longitude is null or (home_longitude >= -180 and home_longitude <= 180)),
  add constraint profiles_home_coordinates_paired
    check ((home_latitude is null) = (home_longitude is null));

-- No new grants or policies. Both tables already grant the columns' privileges
-- at table level, and adding a column does not change who can reach the table —
-- so unlike a new table or function, this is not exposed to `anon` by the
-- deprecated auto-expose setting.
--
-- One consequence worth naming: `profiles` is readable by every signed-in
-- member, so a home town's coordinates are visible to the group, exactly as the
-- `town` text already was. They come from a town-level Places result, not from a
-- device's GPS, so this is the centre of a town rather than anyone's address.
comment on column public.profiles.home_latitude is
  'Centre of the member''s town, from a Places city result. Not a precise address.';
comment on column public.profiles.home_longitude is
  'Centre of the member''s town, from a Places city result. Not a precise address.';
