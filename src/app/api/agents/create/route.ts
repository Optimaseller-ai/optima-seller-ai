import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function ok(url: string) {
  return NextResponse.json({ success: true, url }, { status: 200 });
}

function fail(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

function slugCandidate() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return fail(401, "unauthorized");

  console.log("[agents/create] user", { userId: user.id });

  const { data: sub, error: subErr } = await supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle();
  if (subErr) {
    console.log("[agents/create] subscription error", { userId: user.id, message: subErr.message, code: (subErr as any)?.code ?? null });
    return fail(500, "subscription_lookup_failed");
  }
  if ((sub?.plan ?? "free") !== "pro") return fail(403, "upgrade required");

  const { data: existing, error: exErr } = await supabase
    .from("agents")
    .select("slug")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ slug: string }>();
  if (exErr) {
    console.log("[agents/create] agent lookup error", { userId: user.id, message: exErr.message, code: (exErr as any)?.code ?? null });
    if ((exErr as any)?.code === "PGRST205") return fail(500, "missing_agents_table");
    return fail(500, "agent_lookup_failed");
  }

  const baseUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    (req.headers.get("origin") || "").trim() ||
    "http://localhost:3000";

  if (existing?.slug) return ok(`${baseUrl}/chat/${existing.slug}`);

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("business_name,shop_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr) console.log("[agents/create] profile lookup error", { userId: user.id, message: profErr.message, code: (profErr as any)?.code ?? null });

  const name = String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? "").trim() || "Agent IA";

  for (let attempt = 1; attempt <= 5; attempt++) {
    const slug = slugCandidate();
    console.log("[agents/create] creating agent", { userId: user.id, attempt, slug });

    const { data: created, error: insErr } = await supabase
      .from("agents")
      .insert({ user_id: user.id, name, slug, is_active: true } as any)
      .select("slug")
      .maybeSingle<{ slug: string }>();

    if (!insErr && created?.slug) return ok(`${baseUrl}/chat/${created.slug}`);

    console.log("[agents/create] insert error", { userId: user.id, attempt, message: insErr?.message ?? null, code: (insErr as any)?.code ?? null });
    if ((insErr as any)?.code === "PGRST205") return fail(500, "missing_agents_table");
  }

  return fail(500, "agent_create_failed");
}
