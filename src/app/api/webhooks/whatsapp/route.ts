import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/whatsapp/crypto";
import { sendWhatsAppText, verifyMetaSignature } from "@/lib/whatsapp/meta";
import { runChatCore } from "@/lib/ai/chat-core";
import { consumeOneGenerationOrThrow } from "@/lib/quota/consume";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function GET(req: Request) {
  // Meta webhook verification (hub.challenge)
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = env.WHATSAPP_VERIFY_TOKEN ?? env.META_VERIFY_TOKEN ?? null;
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
    // Signature verification requires WHATSAPP_APP_SECRET.
    // In quick-start environments, allow missing secret (still works, but less secure).
    if (env.WHATSAPP_APP_SECRET) {
      if (!verifyMetaSignature(rawBody, sig)) {
        return NextResponse.json({ ok: false, error: "INVALID_SIGNATURE" }, { status: 401 });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "SIGNATURE_ERROR" }, { status: 500 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Minimal extraction from Cloud API payload
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const phoneNumberId = value?.metadata?.phone_number_id ? String(value.metadata.phone_number_id) : null;
  const message = value?.messages?.[0];
  const from = message?.from ? String(message.from) : null; // customer wa_id
  const text = message?.text?.body ? String(message.text.body) : null;

  if (!phoneNumberId || !from || !text) {
    console.log("WhatsApp webhook ignored (missing fields)", {
      phoneNumberId,
      from,
      hasText: Boolean(text),
      hasStatuses: Boolean(value?.statuses?.length),
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  console.log("WhatsApp inbound message", { phoneNumberId, from, textPreview: text.slice(0, 120) });

  // Load connection by phone_number_id
  let { data: conn, error: connErr } = await admin
    .from("whatsapp_connections")
    .select("id,user_id,phone_number_id,token_enc,token_iv,token_tag,auto_reply_enabled,paused,human_needed")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (connErr) {
    console.error("WhatsApp webhook connection lookup error:", connErr);
    return NextResponse.json({ ok: false, error: connErr.message }, { status: 500 });
  }

  // Quick-start: support single-tenant env vars (META_ACCESS_TOKEN + META_PHONE_NUMBER_ID)
  if (!conn?.user_id && env.META_ACCESS_TOKEN && env.META_PHONE_NUMBER_ID && env.META_PHONE_NUMBER_ID === phoneNumberId) {
    // We can't know which user owns it; ignore if not configured through the app.
    return NextResponse.json({ ok: true, ignored: true, hint: "Configure /app/integrations/whatsapp to bind this number to a user." });
  }

  if (!conn?.user_id) {
    console.log("WhatsApp webhook ignored (no connection bound to user)", { phoneNumberId });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Token expiry guard (best-effort): mark as expired and pause if expired.
  const { data: connMeta } = await admin
    .from("whatsapp_connections")
    .select("token_expires_at,status")
    .eq("id", conn.id)
    .maybeSingle();
  if (connMeta?.token_expires_at) {
    const exp = new Date(connMeta.token_expires_at).getTime();
    if (Number.isFinite(exp) && Date.now() > exp - 30_000) {
      await admin
        .from("whatsapp_connections")
        .update({ status: "expired", paused: true, last_error: "Token Meta expiré. Reconnectez WhatsApp.", updated_at: new Date().toISOString() })
        .eq("id", conn.id);
      return NextResponse.json({ ok: true, paused: true, reason: "TOKEN_EXPIRED" });
    }
  }

  // Basic gates
  if (!conn.auto_reply_enabled || conn.paused || conn.human_needed) {
    console.log("WhatsApp webhook gated (disabled/paused/human)", {
      auto_reply_enabled: conn.auto_reply_enabled,
      paused: conn.paused,
      human_needed: conn.human_needed,
    });
    return NextResponse.json({ ok: true, paused: true });
  }

  // Load user subscription to enforce Pro-only
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan,subscription_status")
    .eq("user_id", conn.user_id)
    .maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") {
    console.log("WhatsApp webhook ignored (not pro)", { userId: conn.user_id, plan: sub?.plan ?? "free" });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Create thread if missing
  const { data: thread } = await admin
    .from("customer_threads")
    .upsert(
      {
        user_id: conn.user_id,
        connection_id: conn.id,
        customer_wa_id: from,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,customer_wa_id" },
    )
    .select("id")
    .maybeSingle();

  const threadId = thread?.id ?? null;

  // Store inbound message
  await admin.from("messages").insert({
    user_id: conn.user_id,
    thread_id: threadId,
    direction: "in",
    wa_message_id: message?.id ? String(message.id) : null,
    body: text,
    created_at: new Date().toISOString(),
  });

  // Escalation heuristic (MVP)
  const lower = text.toLowerCase();
  const needsHuman =
    lower.includes("rembourse") ||
    lower.includes("arnaque") ||
    lower.includes("plainte") ||
    lower.includes("colère") ||
    lower.includes("escro") ||
    lower.includes("litige") ||
    lower.includes("patron") ||
    lower.includes("responsable");

  if (needsHuman) {
    await admin
      .from("whatsapp_connections")
      .update({ human_needed: true, paused: true, updated_at: new Date().toISOString() })
      .eq("id", conn.id);

    if (threadId) {
      await admin.from("sales_events").insert({
        user_id: conn.user_id,
        thread_id: threadId,
        kind: "urgent",
        meta: { reason: "human_needed", text },
        created_at: new Date().toISOString(),
      });
      await admin.from("customer_threads").update({ status: "human_needed", updated_at: new Date().toISOString() }).eq("id", threadId);
    }
    return NextResponse.json({ ok: true, human_needed: true });
  }

  // Consume quota (server-side enforcement)
  try {
    await consumeOneGenerationOrThrow(conn.user_id);
  } catch (e: any) {
    // If quota exhausted, pause automation
    await admin
      .from("whatsapp_connections")
      .update({ paused: true, updated_at: new Date().toISOString() })
      .eq("id", conn.id);
    return NextResponse.json({ ok: true, paused: true, reason: e?.message ?? "QUOTA" });
  }

  // Load business profile context
  const { data: profile } = await admin
    .from("profiles")
    .select("business_name,business_type,goal,country,city,offer,email,full_name")
    .eq("id", conn.user_id)
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

  // Use chat-core with explicit business profile override (webhook has no user cookies).
  const res = await runChatCore({
    message: [
      "Réponds comme un commercial WhatsApp africain performant (poli, rapide, persuasif).",
      "Style: très humain, court (2–6 lignes), naturel, pas robotique. Emoji léger si approprié.",
      "Objectif: avancer vers paiement/rendez-vous. Termine par UNE question simple ou un CTA.",
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
    console.error("WhatsApp webhook chat-core error:", res);
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }

  const reply = res.data.message;

  // Decrypt token and send message back
  const token = decryptSecret({ alg: "aes-256-gcm", data: conn.token_enc, iv: conn.token_iv, tag: conn.token_tag });

  // Anti-robot: small human-like delay before replying (3-12s).
  await sleep(randomInt(3_000, 12_000));
  try {
    await sendWhatsAppText({ token, phoneNumberId, to: from, text: reply });
  } catch (e) {
    console.error("WhatsApp webhook send error:", e);
    throw e;
  }

  await admin.from("messages").insert({
    user_id: conn.user_id,
    thread_id: threadId,
    direction: "out",
    wa_message_id: null,
    body: reply,
    created_at: new Date().toISOString(),
  });

  await admin
    .from("customer_threads")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", threadId);

  // Simple "closed lead" heuristic (MVP): if customer confirms purchase.
  if (lower.includes("je prends") || lower.includes("j'ach") || lower.includes("je valide") || lower.includes("ok je")) {
    await admin.from("sales_events").insert({
      user_id: conn.user_id,
      thread_id: threadId,
      kind: "won",
      meta: { source: "auto_heuristic", text },
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ok: true });
}
