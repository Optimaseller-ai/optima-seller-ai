import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/whatsapp/crypto";
import {
  debugToken,
  discoverWabaAndPhone,
  exchangeCodeForToken,
  subscribeAppToWaba,
  verifySignedState,
} from "@/lib/whatsapp/embedded-signup";

const querySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

function htmlClose(opts: { ok: boolean; message?: string }) {
  const payload = JSON.stringify({ ok: opts.ok, message: opts.message ?? null });
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>WhatsApp Connect</title></head>
<body>
<script>
  try {
    if (window.opener) window.opener.postMessage(${payload}, "*");
  } catch (e) {}
  window.close();
</script>
Connexion WhatsApp…
</body></html>`;
}

export async function GET(req: Request) {
  const h = await headers();
  const origin = h.get("origin") ?? "http://localhost:3000";

  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
    });
    if (!parsed.success) {
      return new Response(htmlClose({ ok: false, message: "Paramètres OAuth invalides." }), { status: 400, headers: { "Content-Type": "text/html" } });
    }

    const cookieState = (await cookies()).get("wa_meta_oauth_state")?.value ?? null;
    if (!cookieState) {
      return new Response(htmlClose({ ok: false, message: "State manquant (cookie expiré). Recommencez." }), { status: 400, headers: { "Content-Type": "text/html" } });
    }

    const expected = verifySignedState(cookieState);
    const got = verifySignedState(parsed.data.state);
    if (!expected || !got || expected !== got) {
      return new Response(htmlClose({ ok: false, message: "State invalide. Recommencez." }), { status: 400, headers: { "Content-Type": "text/html" } });
    }

    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return new Response(htmlClose({ ok: false, message: "Non authentifié. Reconnectez-vous puis recommencez." }), {
        status: 401,
        headers: { "Content-Type": "text/html" },
      });
    }

    const redirectUri = `${origin}/api/integrations/whatsapp/meta/callback`;
    const tokenRes = await exchangeCodeForToken({ code: parsed.data.code, redirectUri });

    const dbg = await debugToken({ accessToken: tokenRes.access_token });
    const metaUserId = typeof (dbg as any)?.data?.user_id === "string" ? (dbg as any).data.user_id : null;
    const expiresAt =
      typeof (dbg as any)?.data?.expires_at === "number" ? new Date((dbg as any).data.expires_at * 1000).toISOString() : null;

    const discovered = await discoverWabaAndPhone({ accessToken: tokenRes.access_token });

    if (discovered.wabaId && tokenRes.access_token) {
      await subscribeAppToWaba({ accessToken: tokenRes.access_token, wabaId: discovered.wabaId });
    }

    if (!discovered.phoneNumberId) {
      // Save token anyway (so we can retry discovery), but mark error.
      const enc = encryptSecret(tokenRes.access_token);
      const admin = createAdminClient();
      await admin.from("whatsapp_connections").upsert(
        {
          user_id: data.user.id,
          provider: "embedded",
          status: "error",
          last_error: "Impossible de récupérer le Phone Number ID via Meta. Vérifiez les permissions/compte.",
          meta_user_id: metaUserId,
          token_enc: enc.data,
          token_iv: enc.iv,
          token_tag: enc.tag,
          token_expires_at: expiresAt,
          business_id: discovered.businessId,
          waba_id: discovered.wabaId,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      return new Response(htmlClose({ ok: false, message: "Connexion partielle: Phone Number introuvable. Ouvrez l’option manuelle." }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const enc = encryptSecret(tokenRes.access_token);
    const admin = createAdminClient();
    const { error: upsertErr } = await admin.from("whatsapp_connections").upsert(
      {
        user_id: data.user.id,
        provider: "embedded",
        status: "connected",
        last_error: null,
        meta_user_id: metaUserId,
        phone_number_id: discovered.phoneNumberId,
        business_account_id: null,
        token_enc: enc.data,
        token_iv: enc.iv,
        token_tag: enc.tag,
        token_expires_at: expiresAt,
        waba_id: discovered.wabaId,
        business_id: discovered.businessId,
        display_phone_number: discovered.displayPhoneNumber,
        verified_name: discovered.verifiedName,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        auto_reply_enabled: true,
        paused: false,
        human_needed: false,
      },
      { onConflict: "user_id" },
    );
    if (upsertErr) throw new Error(upsertErr.message);

    // Clear cookie
    (await cookies()).set("wa_meta_oauth_state", "", { path: "/", maxAge: 0 });

    return new Response(htmlClose({ ok: true, message: "WhatsApp connecté." }), { status: 200, headers: { "Content-Type": "text/html" } });
  } catch (e: any) {
    console.error("Meta OAuth callback error:", e);
    return new Response(htmlClose({ ok: false, message: e?.message ?? "Erreur OAuth Meta." }), { status: 500, headers: { "Content-Type": "text/html" } });
  }
}
