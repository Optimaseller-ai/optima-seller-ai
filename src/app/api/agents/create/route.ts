import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickStableCommercialAgentForSeed } from "@/lib/chat/commercial-agents";

export const runtime = "nodejs";

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

  const baseUrl =
    (process.env.NEXT_PUBLIC_SITE_URL || "").trim() ||
    (req.headers.get("origin") || "").trim() ||
    "http://localhost:3000";

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("business_name,shop_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr) console.log("[agents/create] profile lookup error", { userId: user.id, message: profErr.message, code: (profErr as any)?.code ?? null });

  const businessName = String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? "").trim() || "Notre boutique";

  for (let attempt = 1; attempt <= 5; attempt++) {
    const slug = slugCandidate();
    const persona = pickStableCommercialAgentForSeed(slug);
    console.log("[agents/create] creating agent + link", { userId: user.id, attempt, slug, persona: persona.id });

    const { data: created, error: insErr } = await supabase
      .from("agents")
      .insert({
        user_id: user.id,
        name: businessName,
        slug,
        is_active: true,
        persona_key: persona.id,
      } as any)
      .select("id,slug")
      .maybeSingle<{ id: string; slug: string }>();

    if (!insErr && created?.slug) {
      const linkIns = await supabase.from("chat_links").insert({
        slug: created.slug,
        user_id: user.id,
        agent_id: created.id,
      } as any);

      if (linkIns.error) {
        console.log("[agents/create] chat_links insert error (agent created)", {
          userId: user.id,
          message: linkIns.error.message,
          code: (linkIns.error as any)?.code ?? null,
        });
      }

      return ok(`${baseUrl}/chat/${created.slug}`);
    }

    console.log("[agents/create] insert error", { userId: user.id, attempt, message: insErr?.message ?? null, code: (insErr as any)?.code ?? null });
    if ((insErr as any)?.code === "PGRST205") return fail(500, "missing_agents_table");
  }

  return fail(500, "agent_create_failed");
}
