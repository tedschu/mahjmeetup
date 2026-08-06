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
   '', '', '', '', '', '');

update public.profiles set town = 'Brookline', experience_level = 'intermediate'
  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set town = 'Newton', experience_level = 'advanced'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set town = 'Cambridge', experience_level = 'beginner'
  where id = '33333333-3333-3333-3333-333333333333';

-- Matches: one open that Ted hosts, one Ted joined but does not host, and one
-- completed with scores, so My Matches has both sections populated.
insert into public.matches (id, host_id, date_time, location, notes, supplies_provided, is_league, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   now() + interval '3 days', 'Ted''s House', 'Parking on the street.', true, false, 'open'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
   now() + interval '6 days', 'Community Center', null, false, true, 'open'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   now() - interval '8 days', 'Mei''s Place', 'Great night.', true, false, 'completed');

insert into public.match_players (match_id, player_id, score)
values
  -- Ted hosts, Sarah joined. Still open.
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', null),
  -- Sarah hosts, Ted joined.
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null),
  -- Completed, scored.
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 32),
  ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 18),
  ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 25);
