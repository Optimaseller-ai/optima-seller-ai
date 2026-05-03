import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildEmbeddedSignupUrl, generateState, signState } from "@/lib/whatsapp/embedded-signup";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login?next=/app/whatsapp", (await headers()).get("origin") ?? "http://localhost:3000"));

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const redirectUri = `${origin}/api/integrations/whatsapp/meta/callback`;

  const state = generateState();
  const signedState = signState(state);

  // Store state in httpOnly cookie for CSRF protection
  (await cookies()).set("wa_meta_oauth_state", signedState, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  });

  const url = buildEmbeddedSignupUrl({ redirectUri, signedState });
  return NextResponse.redirect(url);
}

