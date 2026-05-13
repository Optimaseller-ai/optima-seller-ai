-- Drops legacy external messenger bridge tables if present (historical schema).

do $$
begin
  -- policies may reference these tables; drop tables cascades, but be explicit and safe
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='whatsapp_integrations') then
    execute 'drop table public.whatsapp_integrations cascade';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='whatsapp_connections') then
    execute 'drop table public.whatsapp_connections cascade';
  end if;
end $$;

