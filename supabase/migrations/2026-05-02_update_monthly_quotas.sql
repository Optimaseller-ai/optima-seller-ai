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

-- 3) Realtime + client sync needs RLS policies for usage_monthly writes/updates
-- (so the app can keep the monthly counter correct).
drop policy if exists usage_monthly_write_own on public.usage_monthly;
drop policy if exists usage_monthly_update_own on public.usage_monthly;
create policy "usage_monthly_write_own" on public.usage_monthly for insert with check (auth.uid() = user_id);
create policy "usage_monthly_update_own" on public.usage_monthly for update using (auth.uid() = user_id);
