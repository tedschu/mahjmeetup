-- Local development seed. Runs automatically on `supabase db reset`.
-- Never applied to remote — `db push` only ships migrations.
--
-- Sign in as any of these with password: password123

-- Members. The on_auth_user_created trigger derives public.profiles rows from
-- these, reading the name out of raw_user_meta_data.
-- The empty-string token columns are required: GoTrue scans them as non-null
-- strings, and NULLs make every sign-in fail with "Database error querying schema".
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current, reauthentication_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'ted@example.com', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ted"}',
   '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'sarah@example.com', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah"}',
   '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'mei@example.com', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Mei"}',
   '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'jian@example.com', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Jian"}',
   '', '', '', '', '', '');

update public.profiles set town = 'Brookline', experience_level = 'intermediate'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set town = 'Newton', experience_level = 'advanced'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set town = 'Cambridge', experience_level = 'beginner'
  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set town = 'Somerville', experience_level = 'intermediate'
  where id = '44444444-4444-4444-4444-444444444444';

-- Matches: one open that Ted hosts, one Ted joined but does not host, and one
-- completed with scores, so My Matches has both sections populated.
insert into public.matches (id, host_id, date_time, location, notes, supplies_provided, is_league, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   now() + interval '3 days', 'Ted''s House', 'Parking on the street.', true, false, 'open'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   now() + interval '6 days', 'Community Center', null, false, true, 'open'),
  -- Starts open so players can be seated; closed out below, the way a real
  -- match progresses. enforce_match_capacity refuses to seat anyone into a
  -- match that is already completed.
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   now() - interval '8 days', 'Mei''s Place', 'Great night.', true, false, 'open');

-- Hosts are seated automatically by seat_host_after_match_insert, so only the
-- guests are inserted here.
insert into public.match_players (match_id, player_id)
values
  -- Ted hosts, Sarah joined. Still open.
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  -- Sarah hosts, Ted joined.
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  -- Completed match: Sarah and Mei joined Ted.
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333');

update public.match_players set score = 32
  where match_id = 'aaaaaaaa-0000-0000-0000-000000000003'
    and player_id = '11111111-1111-1111-1111-111111111111';
update public.match_players set score = 18
  where match_id = 'aaaaaaaa-0000-0000-0000-000000000003'
    and player_id = '22222222-2222-2222-2222-222222222222';
update public.match_players set score = 25
  where match_id = 'aaaaaaaa-0000-0000-0000-000000000003'
    and player_id = '33333333-3333-3333-3333-333333333333';

update public.matches set status = 'completed'
  where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- A fourth match with an empty seat that Ted is NOT in, so Browse has something
-- joinable, plus one that is already full.
insert into public.matches (id, host_id, date_time, location, notes, supplies_provided, is_league, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333',
   now() + interval '9 days', 'Newton Library', 'Beginners welcome.', true, false, 'open'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
   now() + interval '12 days', 'Brookline Senior Center', null, false, true, 'open');

insert into public.match_players (match_id, player_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222');
-- Fill match 5 to capacity (Sarah hosts, plus three) so the full state is
-- visible in Browse and sync_match_status flips it without any client help.
insert into public.match_players (match_id, player_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444');
