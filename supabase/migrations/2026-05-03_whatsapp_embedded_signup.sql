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
