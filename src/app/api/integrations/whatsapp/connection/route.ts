import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/whatsapp/crypto";

const bodySchema = z.object({
  phone_number_id: z.string().min(1),
  business_account_id: z.string().min(1).nullable().optional(),
  token: z.string().min(1).nullable().optional(),
  auto_reply_enabled: z.boolean().optional().default(false),
  paused: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = bodySchema.parse(await req.json().catch(() => ({})));

  // Pro gate
  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", auth.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return NextResponse.json({ ok: false, error: "PRO_REQUIRED" }, { status: 403 });

  const admin = createAdminClient();

  // If token omitted, keep existing token
  let tokenParts: { token_enc: string; token_iv: string; token_tag: string } | null = null;
  if (body.token) {
    const enc = encryptSecret(body.token);
    tokenParts = { token_enc: enc.data, token_iv: enc.iv, token_tag: enc.tag };
  } else {
    const { data: existing } = await admin
      .from("whatsapp_connections")
      .select("token_enc,token_iv,token_tag")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (existing?.token_enc && existing?.token_iv && existing?.token_tag) {
      tokenParts = { token_enc: existing.token_enc, token_iv: existing.token_iv, token_tag: existing.token_tag };
    } else {
      return NextResponse.json({ ok: false, error: "TOKEN_REQUIRED" }, { status: 400 });
    }
  }

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

  if (upsertErr) return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

