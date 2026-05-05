-- Optima Seller AI - Supabase schema (no payments)
-- Run inside Supabase SQL editor.

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

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

-- WhatsApp Auto Reply (MVP)
create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phone_number_id text not null,
  business_account_id text,
  token_enc text not null,
  token_iv text not null,
  token_tag text not null,
  auto_reply_enabled boolean not null default false,
  paused boolean not null default false,
  human_needed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (phone_number_id)
);

-- Stable Meta OAuth integration storage (new flow)
create table if not exists public.whatsapp_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  meta_business_id text,
  waba_id text,
  phone_number_id text,
  access_token_enc text not null default '',
  access_token_iv text not null default '',
  access_token_tag text not null default '',
  phone_number text,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric,
  category text,
  stock integer,
  promo text,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1536)
);

create table if not exists public.customer_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.whatsapp_connections (id) on delete set null,
  customer_wa_id text not null,
  customer_name text,
  last_message_at timestamptz,
  status text not null default 'open', -- open|human_needed|closed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, customer_wa_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid references public.customer_threads (id) on delete cascade,
  direction text not null, -- in|out
  wa_message_id text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_created_idx on public.messages (thread_id, created_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null, -- escalation|followup
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid references public.customer_threads (id) on delete set null,
  kind text not null, -- lead_hot|closing|won|lost|urgent
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.generations enable row level security;
alter table public.usage_monthly enable row level security;
alter table public.prospects enable row level security;
alter table public.waitlist_features enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.customer_threads enable row level security;
alter table public.messages enable row level security;
alter table public.automation_rules enable row level security;
alter table public.sales_events enable row level security;

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
drop policy if exists usage_monthly_write_own on public.usage_monthly;
drop policy if exists usage_monthly_update_own on public.usage_monthly;
create policy "usage_monthly_select_own" on public.usage_monthly for select using (auth.uid() = user_id);
create policy "usage_monthly_write_own" on public.usage_monthly for insert with check (auth.uid() = user_id);
create policy "usage_monthly_update_own" on public.usage_monthly for update using (auth.uid() = user_id);

drop policy if exists prospects_select_own on public.prospects;
drop policy if exists prospects_insert_own on public.prospects;
drop policy if exists prospects_update_own on public.prospects;
create policy "prospects_select_own" on public.prospects for select using (auth.uid() = user_id);
create policy "prospects_insert_own" on public.prospects for insert with check (auth.uid() = user_id);
create policy "prospects_update_own" on public.prospects for update using (auth.uid() = user_id);

drop policy if exists whatsapp_connections_select_own on public.whatsapp_connections;
drop policy if exists whatsapp_connections_write_own on public.whatsapp_connections;
drop policy if exists whatsapp_connections_update_own on public.whatsapp_connections;
create policy "whatsapp_connections_select_own" on public.whatsapp_connections for select using (auth.uid() = user_id);
create policy "whatsapp_connections_write_own" on public.whatsapp_connections for insert with check (auth.uid() = user_id);
create policy "whatsapp_connections_update_own" on public.whatsapp_connections for update using (auth.uid() = user_id);

drop policy if exists customer_threads_select_own on public.customer_threads;
drop policy if exists customer_threads_write_own on public.customer_threads;
drop policy if exists customer_threads_update_own on public.customer_threads;
create policy "customer_threads_select_own" on public.customer_threads for select using (auth.uid() = user_id);
create policy "customer_threads_write_own" on public.customer_threads for insert with check (auth.uid() = user_id);
create policy "customer_threads_update_own" on public.customer_threads for update using (auth.uid() = user_id);

drop policy if exists messages_select_own on public.messages;
drop policy if exists messages_write_own on public.messages;
create policy "messages_select_own" on public.messages for select using (auth.uid() = user_id);
create policy "messages_write_own" on public.messages for insert with check (auth.uid() = user_id);

drop policy if exists automation_rules_select_own on public.automation_rules;
drop policy if exists automation_rules_write_own on public.automation_rules;
drop policy if exists automation_rules_update_own on public.automation_rules;
create policy "automation_rules_select_own" on public.automation_rules for select using (auth.uid() = user_id);
create policy "automation_rules_write_own" on public.automation_rules for insert with check (auth.uid() = user_id);
create policy "automation_rules_update_own" on public.automation_rules for update using (auth.uid() = user_id);

drop policy if exists sales_events_select_own on public.sales_events;
drop policy if exists sales_events_write_own on public.sales_events;
create policy "sales_events_select_own" on public.sales_events for select using (auth.uid() = user_id);
create policy "sales_events_write_own" on public.sales_events for insert with check (auth.uid() = user_id);

drop policy if exists waitlist_insert_own on public.waitlist_features;
drop policy if exists waitlist_select_own on public.waitlist_features;
create policy "waitlist_insert_own" on public.waitlist_features for insert with check (auth.uid() = user_id);
create policy "waitlist_select_own" on public.waitlist_features for select using (auth.uid() = user_id);
