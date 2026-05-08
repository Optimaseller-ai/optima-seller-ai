import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  signed_request: z.string().min(1),
});

function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [sigB64, payloadB64] = signedRequest.split(".", 2);
  if (!sigB64 || !payloadB64) throw new Error("Invalid signed_request format.");

  const sig = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const payloadJson = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const payload = JSON.parse(payloadJson) as any;

  const expected = crypto.createHmac("sha256", appSecret).update(payloadB64, "utf8").digest();
  if (expected.length !== sig.length || !crypto.timingSafeEqual(expected, sig)) throw new Error("Invalid signed_request signature.");
  return payload;
}

export async function POST(req: Request) {
  try {
    if (!env.META_APP_SECRET) {
      // Still return 200 so Meta doesn't retry forever, but log for us.
      console.error("Meta deauthorize: missing META_APP_SECRET");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      console.error("Meta deauthorize: invalid body", parsed.error);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const payload = parseSignedRequest(parsed.data.signed_request, env.META_APP_SECRET);
    const metaUserId = typeof payload?.user_id === "string" ? payload.user_id : null;
    if (!metaUserId) {
      console.error("Meta deauthorize: missing user_id in payload", payload);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const admin = createAdminClient();

    const { data: conn, error: connErr } = await admin
      .from("whatsapp_connections")
      .select("id,user_id,status")
      .eq("meta_user_id", metaUserId)
      .maybeSingle();

    if (connErr) {
      console.error("Meta deauthorize lookup error:", connErr);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!conn?.id) {
      console.log("Meta deauthorize: no matching connection for meta_user_id", { metaUserId });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const { error: updErr } = await admin
      .from("whatsapp_connections")
      .update({
        status: "disconnected",
        last_error: "Révocation Meta détectée. Reconnectez WhatsApp.",
        token_enc: "",
        token_iv: "",
        token_tag: "",
        token_expires_at: null,
        auto_reply_enabled: false,
        paused: true,
        human_needed: false,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", conn.id);

    if (updErr) console.error("Meta deauthorize update error:", updErr);

    // Log event (best-effort)
    if (conn.user_id) {
      const { error: logErr } = await admin.from("sales_events").insert({
        user_id: conn.user_id,
        thread_id: null,
        kind: "meta_deauthorize",
        meta: { meta_user_id: metaUserId },
        created_at: new Date().toISOString(),
      });
      if (logErr) console.error("Meta deauthorize log error:", logErr);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("Meta deauthorize fatal error:", e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

