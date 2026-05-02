import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profileErr) {
    return NextResponse.json(
      { error: "PROFILE_FETCH_FAIL", details: { message: profileErr.message, code: (profileErr as any)?.code ?? null } },
      { status: 500 },
    );
  }

  const { data: sub, error: subErr } = await supabase
    .from("subscriptions")
    .select("plan,quota_limit,quota_used,expires_at,updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  // Note: subErr can be expected if the table/policies aren't installed yet.
  return NextResponse.json(
    {
      user_id: auth.user.id,
      email: auth.user.email ?? null,
      profile,
      subscription: subErr ? null : sub,
    },
    { status: 200 },
  );
}

