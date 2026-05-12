import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pickStableCommercialAgentForSeed } from "@/lib/chat/commercial-agents";
import ChatLinkClient from "./share-link-client";

export default async function AppChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/chat");

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
  const plan = (sub?.plan ?? "free") as "free" | "pro";

  let agentSlug: string | null = null;
  let recentSlugs: string[] = [];

  if (plan === "pro") {
    const { data: linkRows, error: linkErr } = await supabase
      .from("chat_links")
      .select("slug")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!linkErr && Array.isArray(linkRows) && linkRows.length > 0) {
      recentSlugs = linkRows.map((r: { slug: string }) => r.slug).filter(Boolean);
      agentSlug = recentSlugs[0] ?? null;
    }

    if (recentSlugs.length === 0) {
      const { data: agentsFallback } = await supabase
        .from("agents")
        .select("slug")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (Array.isArray(agentsFallback) && agentsFallback.length > 0) {
        recentSlugs = agentsFallback.map((r: { slug: string }) => r.slug).filter(Boolean);
        agentSlug = recentSlugs[0] ?? null;
      }
    }

    if (!agentSlug) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("business_name,shop_name,full_name,first_name,chat_slug")
        .eq("id", data.user.id)
        .maybeSingle();

      const base =
        (typeof (prof as any)?.chat_slug === "string" && (prof as any).chat_slug.trim()) ||
        String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? (prof as any)?.full_name ?? (prof as any)?.first_name ?? "agent")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) ||
        "agent";

      const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
      const slug = `${base}-${suffix}`;
      const name = String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? "Agent").trim() || "Agent";
      const persona = pickStableCommercialAgentForSeed(slug);

      await supabase
        .from("agents")
        .insert({ user_id: data.user.id, slug, name, is_active: true, persona_key: persona.id } as any);

      const { data: agent2 } = await supabase.from("agents").select("id,slug").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (agent2?.id && agent2.slug) {
        await supabase.from("chat_links").insert({ slug: agent2.slug, user_id: data.user.id, agent_id: agent2.id } as any).catch(() => null);
      }

      const { data: agent3 } = await supabase
        .from("agents")
        .select("slug")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ slug: string }>();
      agentSlug = agent3?.slug ?? null;
      if (agentSlug) recentSlugs = [agentSlug, ...recentSlugs.filter((s) => s !== agentSlug)];
    }
  }

  return <ChatLinkClient plan={plan} slug={agentSlug ?? ""} recentSlugs={recentSlugs} />;
}
