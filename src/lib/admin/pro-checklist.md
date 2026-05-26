# Admin checklist: passer un user en Pro + vérifier le temps réel (Supabase)

## 1) Prérequis

- Le schema SQL a été exécuté (`supabase/schema.sql`).
- Realtime est activé sur la publication `supabase_realtime` (ou `supabase_temps_réel`) pour:
  - `public.profiles`
  - `public.subscriptions`
  - `public.generations`
  - `public.usage_monthly`

## 2) Récupérer l'user_id

Dans Supabase Dashboard:

- **Authentication → Users**
- Copie l'UUID de l'utilisateur (colonne `id`)

> On l'appelle `:user_id` ci-dessous.

## 3) Passer en Pro (plan + quota)

Dans **SQL Editor** (remplace `:user_id`):

```sql
insert into public.subscriptions (user_id, plan, quota_limit, quota_used, expires_at, updated_at)
values (':user_id', 'pro', 500, 0, null, now())
on conflict (user_id)
do update set
  plan = excluded.plan,
  quota_limit = excluded.quota_limit,
  expires_at = excluded.expires_at,
  updated_at = now();
```

Variantes:

- Pro sans limite de date: `expires_at = null`
- Pro jusqu'à une date:

```sql
update public.subscriptions
set expires_at = now() + interval '30 days', updated_at = now()
where user_id = ':user_id';
```

## 4) Vérifier que l’UI se met à jour en temps réel

Dans l'app (connecté avec le même user):

- Ouvre `Dashboard` (`/app`) et laisse l'onglet ouvert
- Ouvre `Generator` (`/app/generator`) et laisse l'onglet ouvert

Dans Supabase (SQL Editor), exécute:

```sql
update public.subscriptions
set quota_limit = 800, updated_at = now()
where user_id = ':user_id';
```

Résultat attendu (sans refresh):

- La navbar / dashboard reflète le plan Pro
- Le quota restant affiché change en direct

## 5) Simuler un quota presque atteint

```sql
update public.subscriptions
set quota_used = quota_limit - 1, updated_at = now()
where user_id = ':user_id';
```

Puis lance 1 génération:
- L’UI doit afficher quota restant = 0 et bloquer l’envoi si quota épuisé.

