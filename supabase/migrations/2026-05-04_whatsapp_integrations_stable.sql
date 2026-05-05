-- Stabilize whatsapp_integrations schema for Meta OAuth flow (non-breaking where possible)

create extension if not exists pgcrypto;

-- Create table if missing (includes extra columns used by current UI: phone_number + status)
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

-- If table existed with older schema, add missing columns safely
alter table public.whatsapp_integrations
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists meta_business_id text,
  add column if not exists waba_id text,
  add column if not exists phone_number_id text,
  add column if not exists access_token_enc text not null default '',
  add column if not exists access_token_iv text not null default '',
  add column if not exists access_token_tag text not null default '',
  add column if not exists phone_number text,
  add column if not exists status text not null default 'disconnected',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Ensure user_id is unique (needed for upsert onConflict=user_id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.whatsapp_integrations'::regclass
      and contype in ('u','p')
      and conname = 'whatsapp_integrations_user_id_key'
  ) then
    begin
      alter table public.whatsapp_integrations add constraint whatsapp_integrations_user_id_key unique (user_id);
    exception when others then
      -- ignore (constraint may already exist with different name)
      null;
    end;
  end if;
end $$;

-- Ensure primary key on id (best-effort; if an old PK exists, keep it to avoid migration failure)
do $$
declare
  has_pk boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conrelid = 'public.whatsapp_integrations'::regclass
      and contype = 'p'
  ) into has_pk;

  if not has_pk then
    begin
      alter table public.whatsapp_integrations add constraint whatsapp_integrations_pkey primary key (id);
    exception when others then
      null;
    end;
  end if;
end $$;

create index if not exists whatsapp_integrations_phone_number_id_idx on public.whatsapp_integrations (phone_number_id);

