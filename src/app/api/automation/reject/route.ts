import { NextResponse } from "next/server";

import { getAutomationJob } from "@/lib/automation/action-queue";
import { resumeWorkflowAfterHumanApproval } from "@/lib/n8n/workflows/human-approval-bridge";
import { ensureSupervisorSession } from "@/lib/automation/supervision-auth";
import { serializeAutomationJobDetail } from "@/lib/automation/supervision-serialize";

export async function POST(req: Request) {
  const gate = await ensureSupervisorSession();
  if (gate instanceof Response) return gate;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const jobId = typeof (payload as { jobId?: unknown })?.jobId === "string" ? (payload as { jobId: string }).jobId : null;
  if (!jobId?.trim()) return NextResponse.json({ error: "jobId requis." }, { status: 400 });

  const updated = await resumeWorkflowAfterHumanApproval({ jobId, choice: "cancel" });
  if (updated.error === "job_not_found_or_not_awaiting") {
    return NextResponse.json({ error: "Action introuvable ou non annulable." }, { status: 404 });
  }

  const job = getAutomationJob(jobId);
  return NextResponse.json({
    ok: true,
    cancelled: true,
    job: job ? serializeAutomationJobDetail(job) : null,
  });
}
