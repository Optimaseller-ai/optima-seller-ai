import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRelanceForConversation } from "@/lib/chat/run-relance";

export const runtime = "nodejs";

const BodySchema = z.object({
  conversation_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // This endpoint is intentionally "public" (no auth cookie) but still protected:
  // - conversation must belong to a PRO user's agent (checked inside runRelanceForConversation)
  // - only triggers when due (unless you add force server-side)
  const admin = createAdminClient();
  const { data: conv } = await admin.from("conversations").select("id").eq("id", parsed.data.conversation_id).maybeSingle();
  if (!conv?.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const out = await runRelanceForConversation({ conversationId: conv.id, force: false });
  if (!out.ok) return NextResponse.json({ ok: false, reason: out.reason }, { status: 200 });

  return NextResponse.json(
    { ok: true, conversation_id: out.conversationId, relance: out.relance, relance_count: out.relanceCount, next_relance_at: out.nextRelanceAt },
    { status: 200 },
  );
}

