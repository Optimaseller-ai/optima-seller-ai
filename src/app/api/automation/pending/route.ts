import { NextResponse } from "next/server";

import {
  getAutomationActionQueueDepth,
  peekAwaitingHumanJobs,
} from "@/lib/automation/action-queue";
import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { serializeAutomationPendingItem } from "@/lib/automation/supervision-serialize";

const DEFAULT_LIMIT = 100;

export async function GET(req: Request) {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;

  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(
    DEFAULT_LIMIT,
    Math.max(1, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 25),
  );

  const jobs = peekAwaitingHumanJobs(limit);
  const depth = getAutomationActionQueueDepth();

  return NextResponse.json({
    awaitingHumanTotal: depth.awaitingHuman,
    returnedCount: jobs.length,
    queueDepth: depth,
    items: jobs.map(serializeAutomationPendingItem),
  });
}
