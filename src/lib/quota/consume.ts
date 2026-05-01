import "server-only";

import { DateTime } from "luxon";
import { createClient } from "@/lib/supabase/server";

export async function ensureSubscriptionRow(userId: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("user_id,plan,quota_limit,quota_used")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing as any;

  const { data: created, error } = await supabase
    .from("subscriptions")
    .upsert(
      { user_id: userId, plan: "free", quota_limit: 10, quota_used: 0, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )
    .select("user_id,plan,quota_limit,quota_used")
    .maybeSingle();
  if (error) throw error;
  return created as any;
}

function isProActive(sub: any) {
  if (sub?.plan !== "pro") return false;
  // Backward compatible: some schemas don't have `expires_at` yet.
  const expiresRaw =
    typeof sub?.expires_at === "string"
      ? sub.expires_at
      : typeof sub?.pro_expires_at === "string"
        ? sub.pro_expires_at
        : typeof sub?.current_period_end === "string"
          ? sub.current_period_end
          : null;
  if (!expiresRaw) return true;
  const dt = DateTime.fromISO(String(expiresRaw));
  return dt.isValid ? dt.toUTC() > DateTime.utc() : true;
}

export async function consumeOneGenerationOrThrow(userId: string) {
  const supabase = await createClient();
  const sub = await ensureSubscriptionRow(userId);

  const plan = isProActive(sub) ? "pro" : "free";
  const quotaLimit = typeof sub.quota_limit === "number" ? sub.quota_limit : plan === "pro" ? 500 : 10;

  const periodStart = DateTime.utc().startOf("month").toISODate();
  const { data: counter, error: counterErr } = await supabase
    .from("usage_monthly")
    .select("used")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (counterErr) throw counterErr;

  const usedThisMonth = typeof counter?.used === "number" ? counter.used : 0;
  if (usedThisMonth >= quotaLimit) {
    throw new Error("Quota atteint pour ce mois. Passez Pro pour continuer.");
  }

  const nextUsed = usedThisMonth + 1;
  if (!counter) {
    const { error: insertErr } = await supabase.from("usage_monthly").insert({
      user_id: userId,
      period_start: periodStart,
      used: nextUsed,
      updated_at: new Date().toISOString(),
    });
    if (insertErr) throw insertErr;
  } else {
    const { data: updatedCounter, error: updateErr } = await supabase
      .from("usage_monthly")
      .update({ used: nextUsed, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("period_start", periodStart)
      .eq("used", usedThisMonth)
      .select("used")
      .maybeSingle();
    if (updateErr) throw updateErr;
    if (!updatedCounter) {
      const { data: latest, error: latestErr } = await supabase
        .from("usage_monthly")
        .select("used")
        .eq("user_id", userId)
        .eq("period_start", periodStart)
        .maybeSingle();
      if (latestErr) throw latestErr;
      const used2 = typeof latest?.used === "number" ? latest.used : 0;
      if (used2 >= quotaLimit) throw new Error("Quota atteint pour ce mois. Passez Pro pour continuer.");
      await supabase
        .from("usage_monthly")
        .update({ used: used2 + 1, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("period_start", periodStart);
    }
  }

  await supabase
    .from("subscriptions")
    .update({ plan, quota_limit: quotaLimit, quota_used: nextUsed, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
