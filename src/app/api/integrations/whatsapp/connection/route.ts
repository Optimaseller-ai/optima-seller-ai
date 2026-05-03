import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/whatsapp/crypto";

const bodySchema = z.object({
  phone_number_id: z.string().min(1, "Phone Number ID requis."),
  business_account_id: z.string().min(1).nullable().optional(),
  token: z.string().min(1, "Token requis."),
  auto_reply_enabled: z.boolean().optional().default(false),
  paused: z.boolean().optional().default(false),
});

function devOnlyStack() {
  return process.env.NODE_ENV !== "production";
}

function jsonError(status: number, error: unknown) {
  const message =
    error instanceof z.ZodError
      ? error.issues?.[0]?.message ?? "Requête invalide."
      : error instanceof Error
        ? error.message
        : "Erreur.";

  const stack = error instanceof Error ? error.stack : undefined;
  return NextResponse.json(
    {
      ok: false,
      success: false,
      message,
      ...(devOnlyStack() ? { stack } : {}),
    },
    { status },
  );
}

async function testMetaPhoneNumberId(opts: { phoneNumberId: string; token: string }) {
  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(opts.phoneNumberId)}?access_token=${encodeURIComponent(
    opts.token,
  )}`;
  const resp = await fetch(url, { method: "GET" });
  const json = (await resp.json().catch(() => ({}))) as any;
  console.log("Meta API test response:", { status: resp.status, ok: resp.ok, json });
  if (!resp.ok) {
    const msg =
      typeof json?.error?.message === "string"
        ? json.error.message
        : typeof json?.message === "string"
          ? json.message
          : `Requête Meta refusée (HTTP ${resp.status}).`;
    throw new Error(msg);
  }
  return json as unknown;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ ok: false, success: false, message: "UNAUTHORIZED" }, { status: 401 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      console.log("WhatsApp connection validation error:", parsed.error);
      return jsonError(400, parsed.error);
    }
    const body = parsed.data;

    // Pro gate
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (subErr) {
      console.error("WhatsApp connection subscription lookup error:", subErr);
      return jsonError(500, new Error(subErr.message));
    }
    if ((sub?.plan ?? "free") !== "pro") return NextResponse.json({ ok: false, success: false, message: "PRO_REQUIRED" }, { status: 403 });

    // Test Meta API before persisting anything
    await testMetaPhoneNumberId({ phoneNumberId: body.phone_number_id, token: body.token });

    const admin = createAdminClient();
    const enc = encryptSecret(body.token);
    const tokenParts = { token_enc: enc.data, token_iv: enc.iv, token_tag: enc.tag };

    const { error: upsertErr } = await admin.from("whatsapp_connections").upsert(
      {
        user_id: auth.user.id,
        phone_number_id: body.phone_number_id,
        business_account_id: body.business_account_id ?? null,
        ...tokenParts,
        auto_reply_enabled: body.auto_reply_enabled,
        paused: body.paused,
        human_needed: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (upsertErr) {
      console.error("WhatsApp connection upsert error:", upsertErr);
      return jsonError(500, new Error(upsertErr.message));
    }

    return NextResponse.json({ ok: true, success: true });
  } catch (error) {
    console.error("WhatsApp connection fatal error:", error);
    return jsonError(400, error);
  }
}

