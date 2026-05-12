-- Persistent commercial personas per chat link + automatic follow-up queue

alter table public.agents add column if not exists persona_key text;

create table if not exists public.chat_links (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists chat_links_slug_unique on public.chat_links (slug);
create index if not exists chat_links_user_created_idx on public.chat_links (user_id, created_at desc);

alter table public.chat_links enable row level security;

drop policy if exists chat_links_select_own on public.chat_links;
drop policy if exists chat_links_insert_own on public.chat_links;
create policy "chat_links_select_own" on public.chat_links for select using (auth.uid() = user_id);
create policy "chat_links_insert_own" on public.chat_links for insert with check (auth.uid() = user_id);

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='conversations') then
    execute $sql$
      create table if not exists public.pending_agent_followups (
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references public.conversations (id) on delete cascade,
        scheduled_for timestamptz not null,
        message text,
        status text not null default 'pending',
        payload jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    $sql$;

    execute $sql$
      create index if not exists pending_agent_followups_due_idx
        on public.pending_agent_followups (scheduled_for asc)
        where status = 'pending';
    $sql$;

    execute 'alter table public.pending_agent_followups enable row level security';

    -- Prospect-facing data is written only via service role / Edge functions; block direct client access
    execute 'drop policy if exists pending_agent_followups_none on public.pending_agent_followups';
    execute 'create policy "pending_agent_followups_none" on public.pending_agent_followups for all using (false)';
  end if;
end $$;
