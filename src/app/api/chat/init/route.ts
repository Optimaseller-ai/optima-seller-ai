import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClientSafe } from "@/lib/supabase/admin";
import { resolvePublicPersonaForAgent } from "@/lib/chat/commercial-agents";

export const runtime = "nodejs";

const BodySchema = z.object({
  slug: z.string().trim().min(2).max(120),
  session_id: z.string().trim().min(8).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { slug, session_id } = parsed.data;
  const admin = createAdminClientSafe();
  if (!admin) {
    return NextResponse.json(
      { error: "chat_unavailable", message: "Configuration Supabase incomplète (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id,user_id,is_active,name,slug,persona_key")
    .eq("slug", slug)
    .maybeSingle();
  if (agentErr) return NextResponse.json({ error: "agent_lookup_failed" }, { status: 500 });
  if (!agent?.id || !agent.is_active) {
    return NextResponse.json(
      {
        error: "unknown_agent",
        message: "Ce lien de chat est invalide ou l'agent est désactivé. Vérifiez le slug dans Paramètres → Chat.",
      },
      { status: 404 },
    );
  }

  const { data: sub } = await admin.from("subscriptions").select("plan").eq("user_id", agent.user_id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") {
    return NextResponse.json(
      {
        error: "agent_not_available",
        message: "Le chat public nécessite un abonnement Pro actif pour ce compte.",
      },
      { status: 403 },
    );
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id,messages")
    .eq("agent_id", agent.id)
    .eq("session_id", session_id)
    .maybeSingle();

  const persona = resolvePublicPersonaForAgent({ personaKey: (agent as any).persona_key, agentId: agent.id });

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, slug: agent.slug },
    persona,
    messages: Array.isArray(conv?.messages) ? conv?.messages : [],
  });
}
