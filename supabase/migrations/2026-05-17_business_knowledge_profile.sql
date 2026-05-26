-- Extensions Knowledge (Profile) — champs non dupliqués avec `profiles`

alter table public.business_knowledge_settings
  add column if not exists sales_style_notes text,
  add column if not exists commercial_instructions text,
  add column if not exists company_important_notes text;
