-- Mémoire comportementale vendeur / prospect (JSON) par conversation
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversations') then
    execute 'alter table public.conversations add column if not exists conversation_state jsonb not null default ''{}''::jsonb';
  end if;
end $$;
