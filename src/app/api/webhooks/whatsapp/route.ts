import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/whatsapp/crypto";
import { sendWhatsAppText, verifyMetaSignature } from "@/lib/whatsapp/meta";
import { runChatCore } from "@/lib/ai/chat-core";
import { getBusinessContext } from "@/lib/ai/business-context";
import { consumeOneGenerationOrThrow } from "@/lib/quota/consume";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = env.WHATSAPP_VERIFY_TOKEN ?? null;
  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-hub-signature-256");

  console.log("WhatsApp webhook POST received", {
    hasSig: Boolean(sig),
    length: rawBody.length,
    contentType: req.headers.get("content-type"),
  });

  try {
    if (env.META_APP_SECRET) {
      if (!verifyMetaSignature(rawBody, sig)) {
        return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 401 });
      }
    }
  } catch (e: any) {
    console.error("WhatsApp signature error:", e);
    return NextResponse.json({ ok: false, error: "SIGNATURE_ERROR" }, { status: 500 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const phoneNumberId = value?.metadata?.phone_number_id ? String(value.metadata.phone_number_id) : null;
  const message = value?.messages?.[0];
  const from = message?.from ? String(message.from) : null;
  const text = message?.text?.body ? String(message.text.body) : null;

  if (!phoneNumberId || !from || !text) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  const { data: integration, error: integrationErr } = await admin
    .from("whatsapp_integrations")
    .select("user_id,phone_number_id,access_token_enc,access_token_iv,access_token_tag,status")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (integrationErr) {
    console.error("WhatsApp integration lookup error:", integrationErr);
    return NextResponse.json({ ok: false, error: "INTEGRATION_LOOKUP_ERROR" }, { status: 500 });
  }

  if (!integration?.user_id || integration.status !== "connected") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Pro gate + quota
  const { data: sub } = await admin.from("subscriptions").select("plan").eq("user_id", integration.user_id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return NextResponse.json({ ok: true, ignored: true });
  try {
    await consumeOneGenerationOrThrow(integration.user_id);
  } catch (e: any) {
    return NextResponse.json({ ok: true, ignored: true, reason: e?.message ?? "QUOTA" });
  }

  // Business profile (optional)
  const { data: profile } = await admin
    .from("profiles")
    .select("business_name,business_type,goal,country,city,offer,email,full_name")
    .eq("id", integration.user_id)
    .maybeSingle();

  const businessProfile = {
    ownerName: profile?.full_name ?? null,
    businessName: profile?.business_name ?? null,
    businessType: profile?.business_type ?? null,
    country: profile?.country ?? null,
    city: profile?.city ?? null,
    whatsapp: null,
    mainGoal: profile?.goal ?? null,
    brandTone: null,
    responseStyle: null,
    primaryLanguage: null,
    offer: profile?.offer ?? null,
  };

  const ctx = await getBusinessContext(integration.user_id, text);
  console.log("WhatsApp context lookup", { kind: ctx.kind, hasContext: Boolean(ctx.context) });

  const res = await runChatCore({
    message: [
      "Réponds comme un vendeur WhatsApp professionnel.",
      "Style: très humain, court (2–6 lignes), naturel, pas robotique.",
      "Objectif: avancer vers paiement/rendez-vous. Termine par UNE question simple ou un CTA.",
      "",
      "Utilise uniquement les informations suivantes (si vide, ne pas inventer):",
      ctx.context || "(vide)",
      "",
      "Message client:",
      text,
    ].join("\n"),
    mode: "reply",
    responseFormat: "single",
    model: "openai/gpt-4o-mini",
    plan: "pro",
    userTimezone: "Africa/Libreville",
    history: [],
    businessProfile,
  } as any);

  if (!res.ok) {
    console.error("WhatsApp webhook AI error:", res);
    return NextResponse.json({ ok: false, error: "AI_ERROR" }, { status: res.status });
  }

  const reply = res.data.message;

  const token = decryptSecret({
    alg: "aes-256-gcm",
    data: integration.access_token_enc,
    iv: integration.access_token_iv,
    tag: integration.access_token_tag,
  });

  try {
    await sendWhatsAppText({ token, phoneNumberId, to: from, text: reply });
  } catch (e) {
    console.error("WhatsApp send error:", e);
    return NextResponse.json({ ok: false, error: "SEND_FAILED" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

