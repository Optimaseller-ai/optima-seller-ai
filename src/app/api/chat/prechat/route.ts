import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { PreChatFormSchema } from "@/lib/prospect/lead-profile/validation";
import {
  emptySmartProspectProfile,
  mergeSmartProspectProfile,
  normalizeContact,
  type SmartProspectProfile,
} from "@/lib/prospect/lead-profile/prospect-profile";
import { hashContactStable, maskEmail, maskPhone } from "@/lib/prospect/pre-chat/privacy";
import { scoreLeadTemperature } from "@/lib/prospect/lead-scoring/lead-temperature";

export const runtime = "nodejs";

const BodySchema = z.object({
  agent_id: z.string().uuid(),
  session_id: z.string().trim().min(8).max(200),
  form: PreChatFormSchema,
  language: z.enum(["fr", "en", "es"]).optional(),
});

function isMissingChatLeadsTable(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return msg.includes("chat_leads") && (msg.includes("does not exist") || msg.includes("relation"));
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { agent_id, session_id, form, language } = parsed.data;
  const admin = createAdminClient();

  const { data: agent } = await admin.from("agents").select("id,is_active").eq("id", agent_id).maybeSingle();
  if (!agent?.id || !agent.is_active) return NextResponse.json({ error: "unknown_agent" }, { status: 404 });

  const { email, phone } = normalizeContact(form.contact);
  const contactHash = hashContactStable(email ?? phone ?? form.contact);

  const messageHint = String(form.primaryNeed ?? "").trim();
  const hasOptionalMessage = messageHint.length >= 2;

  const profile: SmartProspectProfile = mergeSmartProspectProfile(emptySmartProspectProfile(), {
    name: form.name.trim(),
    email,
    phone,
    city: form.city?.trim() || null,
    businessName: form.businessName?.trim() || null,
    primaryNeed: messageHint,
    budget: form.budget?.trim() || null,
    language: language ?? "fr",
    interestLevel: hasOptionalMessage ? "warm" : "cold",
    leadTemperature: scoreLeadTemperature({
      buyingIntentScore: hasOptionalMessage ? 28 : 12,
      turnCount: 0,
      lastUserMessage: messageHint || undefined,
    }),
    lastInteraction: Date.now(),
    createdAt: Date.now(),
  });

  const row = {
    agent_id,
    session_id,
    contact_hash: contactHash,
    lead_profile: profile,
    updated_at: new Date().toISOString(),
  };

  const upsert = await admin.from("chat_leads").upsert(row, { onConflict: "agent_id,session_id" }).select("id").maybeSingle();
  if (upsert.error) {
    if (isMissingChatLeadsTable(upsert.error)) {
      console.warn("[prechat] table chat_leads missing — profile accepted client-side only");
      return NextResponse.json({ ok: true, profile, persisted: false });
    }
    console.error("[prechat] upsert failed", upsert.error.message);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  const masked = email ? maskEmail(email) : phone ? maskPhone(phone) : "***";
  console.log("[prechat] lead saved", { agent_id, session_id: session_id.slice(0, 8) + "…", contact: masked });

  return NextResponse.json({ ok: true, profile, persisted: true, id: upsert.data?.id ?? null });
}
