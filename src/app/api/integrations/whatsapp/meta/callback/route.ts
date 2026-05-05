import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { encryptSecret } from "@/lib/whatsapp/crypto";
import {
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

function safeUserMessage() {
  return "Connexion WhatsApp impossible pour le moment. Réessayez dans 1 minute.";
}

function isSchemaMissingError(err: unknown) {
  const code = typeof (err as any)?.code === "string" ? (err as any).code : null;
  // 42P01: undefined_table, 42703: undefined_column
  return code === "42P01" || code === "42703";
}

function getPgrstMissingColumn(err: unknown) {
  const code = typeof (err as any)?.code === "string" ? (err as any).code : null;
  if (code !== "PGRST204") return null;
  const msg = typeof (err as any)?.message === "string" ? (err as any).message : "";
  const m = msg.match(/Could not find the '([^']+)' column/i);
  return m?.[1] ?? null;
}

export async function GET(req: Request) {
  const redirectUri = env.META_REDIRECT_URI ?? null;
  if (!redirectUri) {
    console.error("Meta OAuth callback: missing META_REDIRECT_URI");
    return new Response(htmlClose({ ok: false, message: safeUserMessage() }), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
    });
    if (!parsed.success) {
      return new Response(htmlClose({ ok: false, message: "Paramètres OAuth invalides. Recommencez." }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const cookieState = (await cookies()).get("wa_meta_oauth_state")?.value ?? null;
    if (!cookieState) {
      return new Response(htmlClose({ ok: false, message: "Connexion expirée. Recommencez." }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const expected = verifySignedState(cookieState);
    const got = verifySignedState(parsed.data.state);
    if (!expected || !got || expected !== got) {
      return new Response(htmlClose({ ok: false, message: "Connexion refusée. Recommencez." }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return new Response(htmlClose({ ok: false, message: "Session expirée. Reconnectez-vous puis recommencez." }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokenRes = await exchangeCodeForToken({ code: parsed.data.code, redirectUri });
    const discovered = await discoverWabaAndPhone({ accessToken: tokenRes.access_token });

    if (discovered.wabaId && tokenRes.access_token) {
      try {
        await subscribeAppToWaba({ accessToken: tokenRes.access_token, wabaId: discovered.wabaId });
      } catch (e) {
        console.error("Meta subscribeAppToWaba error:", e);
      }
    }

    const enc = encryptSecret(tokenRes.access_token);
    const admin = createAdminClient();

    const payload: any = {
      user_id: data.user.id,
      meta_business_id: discovered.businessId,
      waba_id: discovered.wabaId,
      phone_number_id: discovered.phoneNumberId,
      phone_number: discovered.phoneNumber ?? null,
      access_token_enc: enc.data,
      access_token_iv: enc.iv,
      access_token_tag: enc.tag,
      status: discovered.phoneNumberId ? "connected" : "error",
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await admin.from("whatsapp_integrations").upsert(payload, { onConflict: "user_id" });
    if (upsertErr) {
      console.error("WhatsApp integrations upsert error:", upsertErr);

      // Schema cache can be stale (PostgREST). Retry once without the missing column.
      const missingCol = getPgrstMissingColumn(upsertErr);
      if (missingCol && Object.prototype.hasOwnProperty.call(payload, missingCol)) {
        const retryPayload = { ...payload };
        delete (retryPayload as any)[missingCol];
        console.log("WhatsApp integrations upsert retry (dropping missing column)", { missingCol });
        const { error: retryErr } = await admin.from("whatsapp_integrations").upsert(retryPayload, { onConflict: "user_id" });
        if (!retryErr) {
          (await cookies()).set("wa_meta_oauth_state", "", { path: "/", maxAge: 0 });
          return new Response(htmlClose({ ok: true, message: "WhatsApp connecté." }), {
            status: 200,
            headers: { "Content-Type": "text/html" },
          });
        }
        console.error("WhatsApp integrations upsert retry error:", retryErr);
      }

      const msg = isSchemaMissingError(upsertErr) || getPgrstMissingColumn(upsertErr) ? "Mise à jour en cours. Réessayez dans 1 minute." : safeUserMessage();
      return new Response(htmlClose({ ok: false, message: msg }), { status: 200, headers: { "Content-Type": "text/html" } });
    }

    (await cookies()).set("wa_meta_oauth_state", "", { path: "/", maxAge: 0 });

    if (!discovered.phoneNumberId) {
      return new Response(htmlClose({ ok: false, message: "Connexion incomplète: numéro WhatsApp introuvable. Réessayez." }), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(htmlClose({ ok: true, message: "WhatsApp connecté." }), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (e) {
    console.error("Meta OAuth callback fatal error:", e);
    return new Response(htmlClose({ ok: false, message: safeUserMessage() }), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }
}
