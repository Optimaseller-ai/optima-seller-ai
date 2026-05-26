import { NextResponse } from "next/server";

import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { buildSupervisionConversationDetail } from "@/lib/supervision/build-supervision-feed";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;

  const { id } = await ctx.params;
  const detail = await buildSupervisionConversationDetail(gate.userId, id);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ conversation: detail });
}
