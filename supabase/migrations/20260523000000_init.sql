-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text,
  photo_url text,
  xp integer default 15 not null,
  helpful_returns integer default 1 not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Create items table
create table public.items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text not null,
  location text not null,
  date text not null,
  type text check (type in ('lost', 'found')) not null,
  reporter_id uuid references auth.users on delete cascade not null,
  reporter_name text,
  reporter_email text,
  reporter_photo text,
  status text check (status in ('active', 'resolved')) default 'active' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  image_url text
);

-- Enable RLS on items
alter table public.items enable row level security;

-- Profiles Policies
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

create policy "Allow individual user update to own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Allow individual user insert to own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Items Policies
create policy "Allow public read access to active/resolved items" on public.items
  for select using (true);

create policy "Allow authenticated users to insert items" on public.items
  for insert with check (auth.uid() = reporter_id);

create policy "Allow item owners to update their own items" on public.items
  for update using (auth.uid() = reporter_id);

create policy "Allow item owners to delete their own items" on public.items
  for delete using (auth.uid() = reporter_id);

-- Profile creation trigger from Auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, photo_url, xp, helpful_returns)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'display_name', 'Anonymous'),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'photo_url', ''),
    15,
    1
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    photo_url = excluded.photo_url,
    email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
