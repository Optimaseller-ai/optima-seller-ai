-- RLS policies for catalog + documents

alter table public.products enable row level security;
alter table public.documents enable row level security;

drop policy if exists products_select_own on public.products;
drop policy if exists products_insert_own on public.products;
drop policy if exists products_update_own on public.products;
drop policy if exists products_delete_own on public.products;

create policy "products_select_own" on public.products
for select using (auth.uid() = user_id);

create policy "products_insert_own" on public.products
for insert with check (auth.uid() = user_id);

create policy "products_update_own" on public.products
for update using (auth.uid() = user_id);

create policy "products_delete_own" on public.products
for delete using (auth.uid() = user_id);

drop policy if exists documents_select_own on public.documents;
drop policy if exists documents_insert_own on public.documents;
drop policy if exists documents_delete_own on public.documents;

create policy "documents_select_own" on public.documents
for select using (auth.uid() = user_id);

create policy "documents_insert_own" on public.documents
for insert with check (auth.uid() = user_id);

create policy "documents_delete_own" on public.documents
for delete using (auth.uid() = user_id);

