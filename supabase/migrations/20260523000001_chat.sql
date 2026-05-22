-- Create messages table for item claim coordination chats
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  sender_name text not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on messages
alter table public.messages enable row level security;

-- Messages Policies
create policy "Allow authenticated users to read messages" on public.messages
  for select using (auth.uid() is not null);

create policy "Allow users to send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Enable Realtime replication for items and messages tables
begin;
  -- Remove them if they already exist in publication to avoid errors
  alter publication supabase_realtime drop table if exists public.items;
  alter publication supabase_realtime drop table if exists public.messages;
  
  -- Add tables to supabase_realtime publication
  alter publication supabase_realtime add table public.items;
  alter publication supabase_realtime add table public.messages;
commit;
