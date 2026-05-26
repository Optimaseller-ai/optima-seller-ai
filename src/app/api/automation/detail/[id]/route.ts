import { NextResponse } from "next/server";

import { getAutomationJob } from "@/lib/automation/action-queue";
import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { serializeAutomationJobDetail } from "@/lib/automation/supervision-serialize";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;

  const { id } = await ctx.params;
  if (!id?.trim()) return NextResponse.json({ error: "id requis." }, { status: 400 });

  const job = getAutomationJob(id.trim());
  if (!job) return NextResponse.json({ error: "Action introuvable." }, { status: 404 });

  return NextResponse.json({ job: serializeAutomationJobDetail(job) });
}
