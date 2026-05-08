import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatLinkClient from "./share-link-client";

export default async function AppChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/chat");

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
  const plan = (sub?.plan ?? "free") as "free" | "pro";

  let agentSlug: string | null = null;
  if (plan === "pro") {
    const { data: agent } = await supabase
      .from("agents")
      .select("slug")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ slug: string }>();
    agentSlug = agent?.slug ?? null;

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

      await supabase.from("agents").insert({ user_id: data.user.id, slug, name, is_active: true } as any);

      const { data: agent2 } = await supabase
        .from("agents")
        .select("slug")
        .eq("user_id", data.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{ slug: string }>();
      agentSlug = agent2?.slug ?? null;
    }
  }

  return <ChatLinkClient plan={plan} slug={agentSlug ?? ""} />;
}
