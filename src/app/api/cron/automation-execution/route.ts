import { NextResponse } from "next/server";

import { runAutomationExecutionCycle } from "@/lib/automation/automation-execution-engine";
import { sweepAwaitingHumanSoftFallback } from "@/lib/automation/action-queue";

export const runtime = "nodejs";

function getCronSecret() {
  return (process.env.CRON_SECRET || "").trim();
}

/**
 * Cycle autonome — appeler toutes les 30s–60s (Vercel cron ou worker externe).
 * Traite jobs programmées, retries, file n8n, relances chat DB.
 */
export async function POST(req: Request) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 404 });

  const header = req.headers.get("x-cron-secret")?.trim() || "";
  if (header !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stats = await runAutomationExecutionCycle({
    maxActionJobs: 25,
    maxN8nEvents: 20,
    maxChatFollowups: 30,
  });

  const softMinutes = Number(req.headers.get("x-soft-fallback-minutes") ?? "0");
  let softFallbackSwept = 0;
  if (softMinutes > 0) {
    softFallbackSwept = await sweepAwaitingHumanSoftFallback({
      maxAgeMs: Math.min(120, Math.max(5, softMinutes)) * 60 * 1000,
    });
  }

  return NextResponse.json(
    {
      ...stats,
      softFallbackSwept,
    },
    { status: 200 },
  );
}
