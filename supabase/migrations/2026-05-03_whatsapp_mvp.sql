-- WhatsApp Auto Reply MVP (Pro)

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

create table if not exists public.customer_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid references public.whatsapp_connections (id) on delete set null,
  customer_wa_id text not null,
  customer_name text,
  last_message_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, customer_wa_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid references public.customer_threads (id) on delete cascade,
  direction text not null,
  wa_message_id text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_thread_created_idx on public.messages (thread_id, created_at desc);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid references public.customer_threads (id) on delete set null,
  kind text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.whatsapp_connections enable row level security;
alter table public.customer_threads enable row level security;
alter table public.messages enable row level security;
alter table public.automation_rules enable row level security;
alter table public.sales_events enable row level security;

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

