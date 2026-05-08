import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  slug: z.string().trim().min(2).max(120),
  session_id: z.string().trim().min(8).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { slug, session_id } = parsed.data;
  const admin = createAdminClient();

  const { data: agent, error: agentErr } = await admin
    .from("agents")
    .select("id,user_id,is_active,name,slug")
    .eq("slug", slug)
    .maybeSingle();
  if (agentErr) return NextResponse.json({ error: "agent_lookup_failed" }, { status: 500 });
  if (!agent?.id || !agent.is_active) return NextResponse.json({ error: "unknown_agent" }, { status: 404 });

  const { data: sub } = await admin.from("subscriptions").select("plan").eq("user_id", agent.user_id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return NextResponse.json({ error: "agent_not_available" }, { status: 403 });

  const { data: conv } = await admin
    .from("conversations")
    .select("id,messages")
    .eq("agent_id", agent.id)
    .eq("session_id", session_id)
    .maybeSingle();

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, slug: agent.slug },
    messages: Array.isArray(conv?.messages) ? conv?.messages : [],
  });
}

