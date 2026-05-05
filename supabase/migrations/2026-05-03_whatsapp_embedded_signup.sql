-- WhatsApp Embedded Signup fields (non-breaking additive migration)

alter table public.whatsapp_connections
  add column if not exists provider text not null default 'manual',
  add column if not exists status text not null default 'disconnected',
  add column if not exists meta_user_id text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists waba_id text,
  add column if not exists business_id text,
  add column if not exists display_phone_number text,
  add column if not exists verified_name text,
  add column if not exists connected_at timestamptz,
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_error text;

create index if not exists whatsapp_connections_status_idx on public.whatsapp_connections (status);

-- New simplified integration table (Meta Embedded Signup only)
-- Keep existing whatsapp_connections for backward-compat, but new code uses whatsapp_integrations.

create table if not exists public.whatsapp_integrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_enc text not null default '',
  access_token_iv text not null default '',
  access_token_tag text not null default '',
  phone_number_id text,
  business_id text,
  phone_number text,
  status text not null default 'disconnected',
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_integrations_phone_number_id_idx on public.whatsapp_integrations (phone_number_id);
