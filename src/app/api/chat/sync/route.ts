import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({
  agent_id: z.string().uuid(),
  session_id: z.string().trim().min(8).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const admin = createAdminClient();
  const { data: conv, error } = await admin
    .from("conversations")
    .select("messages,updated_at")
    .eq("agent_id", parsed.data.agent_id)
    .eq("session_id", parsed.data.session_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "lookup_failed" }, { status: 500 });

  return NextResponse.json(
    {
      messages: Array.isArray((conv as any)?.messages) ? (conv as any).messages : [],
      updated_at: (conv as any)?.updated_at ?? null,
    },
    { status: 200 },
  );
}
