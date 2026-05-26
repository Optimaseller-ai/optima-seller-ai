-- Business Knowledge: settings, FAQ admin, product search index

-- Settings (1 row / tenant)
create table if not exists public.business_knowledge_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'XOF',
  served_cities text[] not null default '{}',
  business_hours_weekday text,
  business_hours_weekend text,
  delivery_zones_notes text,
  delivery_delay_notes text,
  delivery_cost_notes text,
  delivery_methods text,
  payment_notes text,
  warranty_notes text,
  sav_notes text,
  return_policy_summary text,
  contacts_line text,
  updated_at timestamptz not null default now()
);

-- FAQ entries (admin-validated)
create table if not exists public.business_faq_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (
    category in ('delivery', 'payment', 'warranty', 'sav', 'returns', 'hours', 'general')
  ),
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_faq_entries_user_category_idx
  on public.business_faq_entries (user_id, category);

-- Searchable product index (synced on catalog CRUD)
create table if not exists public.product_knowledge_index (
  product_id uuid primary key references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  search_text text not null,
  name text not null,
  category text,
  price numeric,
  stock integer,
  promo text,
  description_snippet text,
  embedding vector(1536),
  indexed_at timestamptz not null default now()
);

create index if not exists product_knowledge_index_user_id_idx on public.product_knowledge_index (user_id);
create index if not exists product_knowledge_index_search_trgm_idx
  on public.product_knowledge_index using gin (search_text gin_trgm_ops);

-- Catalog search RPC (trigram + token overlap)
create or replace function public.search_catalog_products(
  p_user_id uuid,
  p_query text,
  p_limit int default 8
)
returns table (
  product_id uuid,
  name text,
  price numeric,
  category text,
  stock integer,
  promo text,
  description text,
  rank real
)
language sql stable
as $$
  select
    p.id as product_id,
    p.name,
    p.price,
    p.category,
    p.stock,
    p.promo,
    p.description,
    greatest(
      similarity(
        coalesce(pki.search_text, lower(p.name || ' ' || coalesce(p.description, ''))),
        lower(trim(coalesce(p_query, '')))
      ),
      case
        when trim(coalesce(p_query, '')) <> ''
          and lower(p.name) like '%' || lower(trim(p_query)) || '%'
        then 0.88
        else 0
      end
    )::real as rank
  from public.products p
  left join public.product_knowledge_index pki on pki.product_id = p.id
  where p.user_id = p_user_id
    and (
      trim(coalesce(p_query, '')) = ''
      or lower(p.name) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(p.description, '')) like '%' || lower(trim(p_query)) || '%'
      or lower(coalesce(p.category, '')) like '%' || lower(trim(p_query)) || '%'
      or similarity(
        coalesce(pki.search_text, lower(p.name || ' ' || coalesce(p.description, ''))),
        lower(trim(coalesce(p_query, '')))
      ) > 0.1
    )
  order by rank desc nulls last, p.created_at desc
  limit greatest(p_limit, 1);
$$;

alter table public.business_knowledge_settings enable row level security;
alter table public.business_faq_entries enable row level security;
alter table public.product_knowledge_index enable row level security;

create policy "bks_select_own" on public.business_knowledge_settings for select using (auth.uid() = user_id);
create policy "bks_insert_own" on public.business_knowledge_settings for insert with check (auth.uid() = user_id);
create policy "bks_update_own" on public.business_knowledge_settings for update using (auth.uid() = user_id);

create policy "bfe_select_own" on public.business_faq_entries for select using (auth.uid() = user_id);
create policy "bfe_insert_own" on public.business_faq_entries for insert with check (auth.uid() = user_id);
create policy "bfe_update_own" on public.business_faq_entries for update using (auth.uid() = user_id);
create policy "bfe_delete_own" on public.business_faq_entries for delete using (auth.uid() = user_id);

create policy "pki_select_own" on public.product_knowledge_index for select using (auth.uid() = user_id);
create policy "pki_insert_own" on public.product_knowledge_index for insert with check (auth.uid() = user_id);
create policy "pki_update_own" on public.product_knowledge_index for update using (auth.uid() = user_id);
create policy "pki_delete_own" on public.product_knowledge_index for delete using (auth.uid() = user_id);
