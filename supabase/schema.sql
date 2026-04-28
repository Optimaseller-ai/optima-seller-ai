-- Optima Seller AI - minimal schema
-- Run inside Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  shop_name text,
  business_type text,
  country text,
  city text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null default 'free', -- free|pro|business
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null, -- reply|followup|closing|status
  input text not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  status text not null default 'new', -- new|interested|won|lost
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.generations enable row level security;
alter table public.prospects enable row level security;

-- Policies: per-user access
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_upsert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "subscriptions_write_own" on public.subscriptions
  for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions
  for update using (auth.uid() = user_id);

create policy "generations_select_own" on public.generations
  for select using (auth.uid() = user_id);
create policy "generations_insert_own" on public.generations
  for insert with check (auth.uid() = user_id);

create policy "prospects_select_own" on public.prospects
  for select using (auth.uid() = user_id);
create policy "prospects_insert_own" on public.prospects
  for insert with check (auth.uid() = user_id);
create policy "prospects_update_own" on public.prospects
  for update using (auth.uid() = user_id);

