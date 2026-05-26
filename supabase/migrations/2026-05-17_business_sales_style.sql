alter table public.business_knowledge_settings
  add column if not exists sales_style text default 'balanced';

alter table public.business_knowledge_settings
  drop constraint if exists business_knowledge_settings_sales_style_check;

alter table public.business_knowledge_settings
  add constraint business_knowledge_settings_sales_style_check
  check (sales_style in ('soft', 'balanced', 'aggressive', 'premium'));
