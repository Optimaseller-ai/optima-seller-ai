-- Add conversation status + follow-up (relance) scheduling fields

do $$
begin
  -- status/timestamps
  execute 'alter table public.conversations add column if not exists status text not null default ''active''';
  execute 'alter table public.conversations add column if not exists last_message_at timestamptz';
  execute 'alter table public.conversations add column if not exists last_user_message_at timestamptz';
  execute 'alter table public.conversations add column if not exists last_ai_message_at timestamptz';

  -- relance counters
  execute 'alter table public.conversations add column if not exists relance_count int not null default 0';
  execute 'alter table public.conversations add column if not exists next_relance_at timestamptz';
exception
  when undefined_table then
  -- conversations table may not exist yet in some environments
    null;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='conversations') then
    execute 'create index if not exists conversations_status_idx on public.conversations (status)';
    execute 'create index if not exists conversations_next_relance_idx on public.conversations (next_relance_at) where next_relance_at is not null';
    execute 'create index if not exists conversations_last_user_message_idx on public.conversations (last_user_message_at desc)';
  end if;
end $$;
