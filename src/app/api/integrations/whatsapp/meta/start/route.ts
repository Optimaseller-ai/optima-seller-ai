import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildEmbeddedSignupUrl, generateState, signState } from "@/lib/whatsapp/embedded-signup";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const originHeader = (await headers()).get("origin") ?? "http://localhost:3000";
    const baseUrl = env.NEXT_PUBLIC_SITE_URL ?? originHeader;

    if (!data.user) return NextResponse.redirect(new URL("/login?next=/app/whatsapp", baseUrl));

    // Explicit env validation for clearer 500s
    const missing: string[] = [];
    if (!env.META_APP_ID) missing.push("META_APP_ID");
    if (!env.META_APP_SECRET) missing.push("META_APP_SECRET");
    if (!env.META_CONFIG_ID) missing.push("META_CONFIG_ID");
    if (!env.META_OAUTH_STATE_SECRET && !env.META_APP_SECRET) missing.push("META_OAUTH_STATE_SECRET");
    if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);

    const redirectUri = `${baseUrl}/api/integrations/whatsapp/meta/callback`;

    const state = generateState();
    const signedState = signState(state);

    // Store state in httpOnly cookie for CSRF protection
    (await cookies()).set("wa_meta_oauth_state", signedState, {
      httpOnly: true,
      sameSite: "lax",
      secure: baseUrl.startsWith("https://"),
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
