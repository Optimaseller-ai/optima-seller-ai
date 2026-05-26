-- Colonnes analytics / liste conversations + trigger updated_at (évite PGRST204 si migration relance absente ou partielle)

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversations') then
    execute 'alter table public.conversations add column if not exists last_ai_message_at timestamptz';
    execute 'alter table public.conversations add column if not exists last_user_message_at timestamptz';
    execute 'alter table public.conversations add column if not exists last_message_preview text';
    execute 'alter table public.conversations add column if not exists updated_at timestamptz not null default now()';
  end if;
end $$;

-- Trigger: maintient updated_at à chaque UPDATE
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger (table requise)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversations') then
    drop trigger if exists update_conversations_updated_at on public.conversations;
    create trigger update_conversations_updated_at
      before update on public.conversations
      for each row
      execute function public.update_updated_at_column();
  end if;
end $$;
