"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BusinessFaqCategory } from "@/lib/business-knowledge/types";
import { normalizeBusinessSalesStyle } from "@/lib/business-knowledge/sales/sales-style-config";

async function requireAuth() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" as const, supabase: null, userId: null };
  return { ok: true as const, supabase, userId: auth.user.id };
}

/** Sauvegarde uniquement les champs Knowledge (pas identité profil). */
export async function saveProfileBusinessKnowledge(formData: FormData) {
  const gate = await requireAuth();
  if (!gate.ok) return gate;

  const servedRaw = String(formData.get("served_cities_extra") ?? "").trim();
  const served_cities = servedRaw
    ? servedRaw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const { data: existing } = await gate.supabase!
    .from("business_knowledge_settings")
    .select("currency")
    .eq("user_id", gate.userId!)
    .maybeSingle();

  const row = {
    user_id: gate.userId!,
    currency: String(existing?.currency ?? "XOF"),
    served_cities,
    business_hours_weekday: String(formData.get("business_hours_weekday") ?? "").trim() || null,
    business_hours_weekend: String(formData.get("business_hours_weekend") ?? "").trim() || null,
    delivery_zones_notes: String(formData.get("delivery_zones_notes") ?? "").trim() || null,
    delivery_delay_notes: String(formData.get("delivery_delay_notes") ?? "").trim() || null,
    delivery_cost_notes: String(formData.get("delivery_cost_notes") ?? "").trim() || null,
    delivery_methods: String(formData.get("delivery_methods") ?? "").trim() || null,
    payment_notes: String(formData.get("payment_notes") ?? "").trim() || null,
    warranty_notes: String(formData.get("warranty_notes") ?? "").trim() || null,
    sav_notes: String(formData.get("sav_notes") ?? "").trim() || null,
    return_policy_summary: String(formData.get("return_policy_summary") ?? "").trim() || null,
    sales_style: normalizeBusinessSalesStyle(String(formData.get("sales_style") ?? "")) ?? "balanced",
    sales_style_notes: String(formData.get("sales_style_notes") ?? "").trim() || null,
    commercial_instructions: String(formData.get("commercial_instructions") ?? "").trim() || null,
    company_important_notes: String(formData.get("company_important_notes") ?? "").trim() || null,
    contacts_line: null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await gate.supabase!.from("business_knowledge_settings").upsert(row, { onConflict: "user_id" });
  if (error) {
    console.error("saveProfileBusinessKnowledge", error);
    return { ok: false as const, message: "SAVE_FAILED" };
  }
  revalidatePath("/app/profile");
  return { ok: true as const };
}

export async function addProfileBusinessFaq(formData: FormData) {
  const gate = await requireAuth();
  if (!gate.ok) return gate;

  const category = String(formData.get("category") ?? "general").trim() as BusinessFaqCategory;
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  if (!question || !answer) return { ok: false as const, message: "FAQ_INCOMPLETE" };

  const allowed: BusinessFaqCategory[] = ["delivery", "payment", "warranty", "sav", "returns", "hours", "general"];
  const cat = allowed.includes(category) ? category : "general";

  const { error } = await gate.supabase!.from("business_faq_entries").insert({
    user_id: gate.userId!,
    category: cat,
    question,
    answer,
  });
  if (error) return { ok: false as const, message: "SAVE_FAILED" };
  revalidatePath("/app/profile");
  return { ok: true as const };
}

export async function deleteProfileBusinessFaq(faqId: string, _formData?: FormData) {
  const gate = await requireAuth();
  if (!gate.ok) return gate;

  const { error } = await gate.supabase!.from("business_faq_entries").delete().eq("id", faqId).eq("user_id", gate.userId!);
  if (error) return { ok: false as const, message: "DELETE_FAILED" };
  revalidatePath("/app/profile");
  return { ok: true as const };
}

/** Form actions for client components — return void per Next.js form action contract. */
export async function saveProfileBusinessKnowledgeFormAction(formData: FormData): Promise<void> {
  await saveProfileBusinessKnowledge(formData);
}

export async function addProfileBusinessFaqFormAction(formData: FormData): Promise<void> {
  await addProfileBusinessFaq(formData);
}

export async function deleteProfileBusinessFaqFormAction(faqId: string, _formData: FormData): Promise<void> {
  await deleteProfileBusinessFaq(faqId, _formData);
}
