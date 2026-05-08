import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Plan = "free" | "pro";

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = await createClient();
  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", userId).maybeSingle();
  return (sub?.plan ?? "free") as Plan;
}

export async function requireProOrThrow(userId: string) {
  const plan = await getUserPlan(userId);
  if (plan !== "pro") throw new Error("Passez en Pro pour accéder à cette fonctionnalité.");
}

