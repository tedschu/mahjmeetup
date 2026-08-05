-- Create a table for public profiles
create table public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  town text,
  experience_level text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS) for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Create a table for matches
create table public.matches (
  id uuid default gen_random_uuid() primary key,
  host_id uuid references public.profiles(id) not null,
  date_time timestamp with time zone not null,
  location text not null,
  notes text,
  supplies_provided boolean default false,
  is_league boolean default false,
  status text default 'open' check (status in ('open', 'full', 'completed', 'canceled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up RLS for matches
alter table public.matches enable row level security;
create policy "Matches are viewable by everyone." on public.matches for select using (true);
create policy "Authenticated users can create matches." on public.matches for insert with check (auth.role() = 'authenticated');
create policy "Hosts can update their matches." on public.matches for update using (auth.uid() = host_id);

-- Create a table for match players (the junction table for members joining matches)
create table public.match_players (
  match_id uuid references public.matches(id) on delete cascade not null,
  player_id uuid references public.profiles(id) on delete cascade not null,
  score integer,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (match_id, player_id)
);

-- Set up RLS for match players
alter table public.match_players enable row level security;
create policy "Match players are viewable by everyone." on public.match_players for select using (true);
create policy "Users can join matches." on public.match_players for insert with check (auth.uid() = player_id);
create policy "Users can leave matches." on public.match_players for delete using (auth.uid() = player_id);
-- Only the host can update scores (we'd ideally enforce this with a function, but for now we allow any participant)
create policy "Participants can update scores." on public.match_players for update using (auth.uid() = player_id);

-- Function to handle new user signup automatically creating a profile
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
