import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildEmbeddedSignupUrl, generateState, signState } from "@/lib/whatsapp/embedded-signup";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const redirectUri = env.META_REDIRECT_URI ?? null;

    if (!redirectUri) throw new Error("Missing META_REDIRECT_URI.");
    if (!data.user) return NextResponse.redirect(new URL("/login?next=/app/whatsapp", env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));

    // Explicit env validation for clearer 500s
    const missing: string[] = [];
    if (!env.META_APP_ID) missing.push("META_APP_ID");
    if (!env.META_APP_SECRET) missing.push("META_APP_SECRET");
    if (!env.META_REDIRECT_URI) missing.push("META_REDIRECT_URI");
    if (!env.WHATSAPP_VERIFY_TOKEN) missing.push("WHATSAPP_VERIFY_TOKEN");
    if (!env.WHATSAPP_TOKEN_ENC_KEY) missing.push("WHATSAPP_TOKEN_ENC_KEY");
    if (!env.META_OAUTH_STATE_SECRET && !env.META_APP_SECRET) missing.push("META_OAUTH_STATE_SECRET");
    if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);

    const state = generateState();
    const signedState = signState(state);

    // Store state in httpOnly cookie for CSRF protection
    (await cookies()).set("wa_meta_oauth_state", signedState, {
      httpOnly: true,
      sameSite: "lax",
      secure: redirectUri.startsWith("https://"),
      path: "/",
      maxAge: 10 * 60,
    });

    const url = buildEmbeddedSignupUrl({ redirectUri, signedState });
    return NextResponse.redirect(url);
  } catch (error: any) {
    console.error("Meta OAuth start error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? "OAuth start error",
      },
      { status: 500 },
    );
  }
}
