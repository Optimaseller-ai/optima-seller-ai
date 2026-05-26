-- Historique des actions automation — anti-spam / cooldowns persistants

create table if not exists public.automation_action_history (
  id uuid primary key default gen_random_uuid(),
  prospect_id text not null,
  conversation_id text not null,
  agent_id text,
  session_id text,
  action_type text not null,
  action_channel text not null,
  executed_at timestamptz not null default now(),
  cooldown_until timestamptz not null,
  status text not null default 'executed',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists automation_action_history_conv_idx
  on public.automation_action_history (conversation_id, executed_at desc);

create index if not exists automation_action_history_cooldown_idx
  on public.automation_action_history (conversation_id, cooldown_until desc);

create index if not exists automation_action_history_type_idx
  on public.automation_action_history (conversation_id, action_type, action_channel);

comment on table public.automation_action_history is 'Cooldowns automation Optima — email, relances, workflows n8n';
