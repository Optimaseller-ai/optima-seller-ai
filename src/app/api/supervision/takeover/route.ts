import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { conversationsUpdateWithOptionalColumnFallback } from "@/lib/chat/conversation-state-db";
import {
  mergeTakeoverIntoConversationState,
  type ConversationTakeoverMode,
} from "@/lib/supervision/conversation-takeover";
import { bumpSupervisionCache, emitSupervisionFeedItem } from "@/lib/supervision/supervision-event-bus";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  mode: z.enum(["AI_ACTIVE", "HUMAN_ACTIVE", "HYBRID"]),
});

export async function POST(req: Request) {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;
  if (!gate.userId) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { conversationId, mode } = parsed.data;
  const admin = createAdminClient();

  const { data: conv } = await admin
    .from("conversations")
    .select("id,agent_id,conversation_state")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: agent } = await admin.from("agents").select("user_id").eq("id", conv.agent_id).maybeSingle();
  if (agent?.user_id !== gate.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const prev =
    typeof conv.conversation_state === "object" && conv.conversation_state
      ? (conv.conversation_state as Record<string, unknown>)
      : {};

  const nextState = mergeTakeoverIntoConversationState(prev, {
    mode: mode as ConversationTakeoverMode,
    supervisorUserId: gate.userId,
  });

  const { error } = await conversationsUpdateWithOptionalColumnFallback(admin, conversationId, {
    conversation_state: nextState,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  emitSupervisionFeedItem({
    id: `takeover_${conversationId}_${Date.now()}`,
    at: new Date().toISOString(),
    kind: "agent_action",
    title: `Mode ${mode}`,
    preview: "Reprise de conversation par l’administrateur.",
    conversationId,
    agentId: conv.agent_id,
  });
  bumpSupervisionCache();

  return NextResponse.json({ ok: true, mode });
}
