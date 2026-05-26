-- Catalog + Documents ingestion for commercial AI context

create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

-- Products
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  price numeric,
  category text,
  stock integer,
  promo text,
  description text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists products_user_id_idx on public.products (user_id);
create index if not exists products_name_trgm_idx on public.products using gin (name gin_trgm_ops);

-- Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents (user_id);

-- Document chunks + embeddings
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(1536)
);

create index if not exists document_chunks_document_id_idx on public.document_chunks (document_id);
create index if not exists document_chunks_user_id_idx on public.document_chunks (user_id);

-- Optional IVF index for faster vector search (requires ANALYZE + enough rows)
-- create index if not exists document_chunks_embedding_ivfflat_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Vector search RPC (cosine distance)
create or replace function public.match_document_chunks(
  p_user_id uuid,
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  distance float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    (dc.embedding <=> query_embedding) as distance
  from public.document_chunks dc
  where dc.user_id = p_user_id
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
