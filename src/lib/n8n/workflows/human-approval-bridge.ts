import "server-only";

import {
  getAutomationJob,
  processAutomationActionJob,
  resolveAutomationJobHumanApproval,
  setAutomationJobStatus,
} from "@/lib/automation/action-queue";
import { logAutomation } from "@/lib/automation/event-log";

import { dispatchN8nAction } from "../dispatch/n8n-action-dispatcher";
import { getWorkflowRunByJobId, transitionWorkflowRun } from "./workflow-status-tracker";

export type HumanApprovalResumeResult = {
  dispatched: boolean;
  runId?: string;
  error?: string;
};

/**
 * Pont validation humaine → reprise automatique du workflow n8n.
 */
export async function resumeWorkflowAfterHumanApproval(args: {
  jobId: string;
  choice: "send" | "modify" | "cancel";
}): Promise<HumanApprovalResumeResult> {
  const job = resolveAutomationJobHumanApproval({
    jobId: args.jobId,
    choice: args.choice,
  });

  if (!job) {
    return { dispatched: false, error: "job_not_found_or_not_awaiting" };
  }

  if (args.choice === "cancel") {
    const run = getWorkflowRunByJobId(job.id);
    if (run) transitionWorkflowRun(run.runId, "failed", { lastError: "human_cancelled" });
    logAutomation({
      level: "info",
      event: job.event,
      message: "n8n_human_approval_cancelled",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId: job.id },
    });
    return { dispatched: false, error: "cancelled" };
  }

  const run = getWorkflowRunByJobId(job.id);
  if (run) transitionWorkflowRun(run.runId, "queued", { metadata: { humanApproved: true } });

  logAutomation({
    level: "info",
    event: job.event,
    message: "n8n_human_approval_released",
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    meta: { jobId: job.id, choice: args.choice },
  });

  if (args.choice === "send") {
    const fresh = getAutomationJob(job.id);
    if (!fresh) return { dispatched: false, error: "job_not_found" };
    const dispatch = await dispatchN8nAction(fresh);
    if (dispatch.ok) {
      setAutomationJobStatus(fresh, "completed");
      return { dispatched: true, runId: dispatch.runId };
    }
    if (dispatch.status === "retrying") {
      fresh.nextRetryAt = new Date(Date.now() + 2000).toISOString();
      setAutomationJobStatus(fresh, "retrying");
      return { dispatched: false, runId: dispatch.runId, error: dispatch.error };
    }
    fresh.lastError = dispatch.error;
    setAutomationJobStatus(fresh, "failed");
    return { dispatched: false, runId: dispatch.runId, error: dispatch.error };
  }

  await processAutomationActionJob(job.id);
  const updated = getAutomationJob(job.id);
  const runAfter = getWorkflowRunByJobId(job.id);
  return {
    dispatched: updated?.status === "completed" || updated?.status === "auto_executed",
    runId: runAfter?.runId,
    error: updated?.lastError,
  };
}
