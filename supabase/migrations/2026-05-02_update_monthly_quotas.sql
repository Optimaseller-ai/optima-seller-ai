-- Optima Seller AI - Monthly quota update (2026-05-02)
-- Free: 100 generations / month
-- Pro: 2000 generations / month

-- 1) Ensure new rows default to 100 for free users.
alter table public.subscriptions alter column quota_limit set default 100;

-- 2) Migrate existing users (best-effort, preserves higher custom quotas).
update public.subscriptions
set quota_limit = 100,
    updated_at = now()
where (plan is null or plan = 'free')
  and (quota_limit is null or quota_limit < 100);

update public.subscriptions
set quota_limit = 2000,
    updated_at = now()
where plan = 'pro'
  and (quota_limit is null or quota_limit < 2000);

