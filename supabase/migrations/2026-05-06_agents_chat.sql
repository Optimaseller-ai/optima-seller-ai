-- Agents + public chat conversations (JSON messages)

create extension if not exists pgcrypto;

-- Rename legacy shared-chat tables created earlier in this repo
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='conversation_messages') then
    execute 'alter table public.conversation_messages rename to legacy_conversation_messages';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='conversations') then
    execute 'alter table public.conversations rename to legacy_conversations';
  end if;
end $$;

-- Agents (one per PRO user for now)
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Agent',
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists agents_slug_unique on public.agents (slug);
create index if not exists agents_user_id_idx on public.agents (user_id);

-- Conversations (stored as JSON for simple replay)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  session_id text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists conversations_agent_session_unique on public.conversations (agent_id, session_id);
create index if not exists conversations_agent_updated_idx on public.conversations (agent_id, updated_at desc);

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.ensure_agent_for_pro_user(p_user_id uuid)
returns void
language plpgsql
as $$
declare
  prof record;
  base text;
  candidate text;
  suffix text;
begin
  if exists (select 1 from public.agents a where a.user_id = p_user_id) then
    return;
  end if;

  select business_name, shop_name, full_name, first_name
    into prof
  from public.profiles
  where id = p_user_id;

  base := public.slugify(coalesce(prof.business_name, prof.shop_name, prof.full_name, prof.first_name));
  if base is null or length(base) < 2 then
    base := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  end if;

  suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  candidate := base || '-' || suffix;

  for i in 1..6 loop
    exit when not exists (select 1 from public.agents a where a.slug = candidate);
    suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    candidate := base || '-' || suffix;
  end loop;

  insert into public.agents (user_id, name, slug, is_active)
  values (p_user_id, coalesce(prof.business_name, prof.shop_name, 'Agent'), candidate, true);
end;
$$;

create or replace function public.on_subscription_provision_agent()
returns trigger
language plpgsql
as $$
begin
  if new.plan = 'pro' then
    perform public.ensure_agent_for_pro_user(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists subscriptions_provision_agent on public.subscriptions;
create trigger subscriptions_provision_agent
after insert or update of plan on public.subscriptions
for each row execute function public.on_subscription_provision_agent();

-- RLS
alter table public.agents enable row level security;
alter table public.conversations enable row level security;

drop policy if exists agents_select_own on public.agents;
drop policy if exists agents_write_own on public.agents;
drop policy if exists agents_update_own on public.agents;
create policy "agents_select_own" on public.agents for select using (auth.uid() = user_id);
create policy "agents_write_own" on public.agents for insert with check (auth.uid() = user_id);
create policy "agents_update_own" on public.agents for update using (auth.uid() = user_id);

drop policy if exists conversations_select_own on public.conversations;
drop policy if exists conversations_write_own on public.conversations;
drop policy if exists conversations_update_own on public.conversations;
create policy "conversations_select_own" on public.conversations
for select
using (
  exists (
    select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()
  )
);
create policy "conversations_write_own" on public.conversations
for insert
with check (
  exists (
    select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()
  )
);
create policy "conversations_update_own" on public.conversations
for update
using (
  exists (
    select 1 from public.agents a where a.id = agent_id and a.user_id = auth.uid()
  )
);

