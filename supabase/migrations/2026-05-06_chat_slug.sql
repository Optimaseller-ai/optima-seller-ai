-- Chat slug for public shared chat links

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists chat_slug text;

-- Back-compat: if `public_slug` exists, keep values in `chat_slug`
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'public_slug'
  ) then
    execute 'update public.profiles set chat_slug = coalesce(chat_slug, public_slug) where public_slug is not null';
  end if;
end $$;

create unique index if not exists profiles_chat_slug_unique on public.profiles (chat_slug) where chat_slug is not null;

create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.ensure_profile_chat_slug()
returns trigger
language plpgsql
as $$
declare
  base text;
  candidate text;
  suffix text;
begin
  if new.chat_slug is not null and length(trim(new.chat_slug)) > 0 then
    return new;
  end if;

  base := public.slugify(coalesce(new.business_name, new.shop_name, new.full_name, new.first_name));
  if base is null or length(base) < 2 then
    base := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  end if;

  suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
  candidate := base || '-' || suffix;

  -- retry a few times on collision
  for i in 1..5 loop
    exit when not exists (select 1 from public.profiles p where p.chat_slug = candidate and p.id <> new.id);
    suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
    candidate := base || '-' || suffix;
  end loop;

  new.chat_slug := candidate;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_chat_slug on public.profiles;
create trigger profiles_ensure_chat_slug
before insert or update on public.profiles
for each row execute function public.ensure_profile_chat_slug();

