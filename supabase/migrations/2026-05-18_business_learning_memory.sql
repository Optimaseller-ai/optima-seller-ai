-- Mémoire d’apprentissage métier (explicable, par utilisateur / business)
alter table public.profiles
  add column if not exists learning_memory jsonb not null default '{}'::jsonb;

comment on column public.profiles.learning_memory is
  'Optima Seller AI — patterns conversion, relances, produits, objections (Business Learning Engine)';
