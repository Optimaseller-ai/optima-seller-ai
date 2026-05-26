-- Public chat leads (pre-chat capture, separate from merchant CRM prospects)

create table if not exists public.chat_leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  session_id text not null,
  contact_hash text,
  lead_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_leads_agent_session_unique on public.chat_leads (agent_id, session_id);
create index if not exists chat_leads_agent_updated_idx on public.chat_leads (agent_id, updated_at desc);
create index if not exists chat_leads_contact_hash_idx on public.chat_leads (agent_id, contact_hash) where contact_hash is not null;

alter table public.chat_leads enable row level security;
