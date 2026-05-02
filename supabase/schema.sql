-- Optima Seller AI - Supabase schema (no payments)
-- Run inside Supabase SQL editor.

-- Extensions
create extension if not exists pgcrypto;

-- Profiles (business memory)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  business_name text,
  business_type text,
  goal text,
  country text,
  city text,
  whatsapp text,
  offer text,
  email text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Backward compatible columns (older UI)
  first_name text,
  shop_name text,
  main_goal text,
  whatsapp_number text,
  offer_description text
);

-- If `profiles` already existed, ensure new memory columns are present.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists business_name text;
alter table public.profiles add column if not exists business_type text;
alter table public.profiles add column if not exists goal text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists whatsapp text;
alter table public.profiles add column if not exists offer text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Subscriptions (manual for now)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free', -- free|pro
  subscription_status text, -- active|pending|canceled
  quota_limit integer not null default 100,
  quota_used integer not null default 0,
  expires_at timestamptz,
  pro_since timestamptz,
  payment_provider text,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions add column if not exists subscription_status text;
alter table public.subscriptions add column if not exists pro_since timestamptz;
alter table public.subscriptions add column if not exists payment_provider text;
alter table public.subscriptions add column if not exists payment_reference text;

-- Generations history
create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null, -- reply|followup|closing|complaint|promo|business_chat
  input text not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists generations_user_created_idx on public.generations (user_id, created_at desc);

-- Monthly quota counters (resets automatically by period)
create table if not exists public.usage_monthly (
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

-- Prospects (CRM)
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

-- Waitlist
create table if not exists public.waitlist_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_features_user_feature_unique
  on public.waitlist_features (user_id, feature);

-- RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.generations enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.prospects enable row level security;
alter table public.waitlist_features enable row level security;

-- Policies: per-user access
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_upsert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_upsert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_write_own on public.subscriptions;
drop policy if exists subscriptions_update_own on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select using (auth.uid() = user_id);
create policy "subscriptions_write_own" on public.subscriptions for insert with check (auth.uid() = user_id);
create policy "subscriptions_update_own" on public.subscriptions for update using (auth.uid() = user_id);

drop policy if exists generations_select_own on public.generations;
drop policy if exists generations_insert_own on public.generations;
create policy "generations_select_own" on public.generations for select using (auth.uid() = user_id);
create policy "generations_insert_own" on public.generations for insert with check (auth.uid() = user_id);

drop policy if exists usage_monthly_select_own on public.usage_monthly;
create policy "usage_monthly_select_own" on public.usage_monthly for select using (auth.uid() = user_id);

drop policy if exists prospects_select_own on public.prospects;
drop policy if exists prospects_insert_own on public.prospects;
drop policy if exists prospects_update_own on public.prospects;
create policy "prospects_select_own" on public.prospects for select using (auth.uid() = user_id);
create policy "prospects_insert_own" on public.prospects for insert with check (auth.uid() = user_id);
create policy "prospects_update_own" on public.prospects for update using (auth.uid() = user_id);

drop policy if exists waitlist_insert_own on public.waitlist_features;
drop policy if exists waitlist_select_own on public.waitlist_features;
create policy "waitlist_insert_own" on public.waitlist_features for insert with check (auth.uid() = user_id);
create policy "waitlist_select_own" on public.waitlist_features for select using (auth.uid() = user_id);
