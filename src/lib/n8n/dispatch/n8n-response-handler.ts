import "server-only";

import { appendAutomationJobLog, getAutomationJob, setAutomationJobStatus } from "@/lib/automation/action-queue";
import { logAutomation } from "@/lib/automation/event-log";

import type { N8nCallbackPayload } from "../events/n8n-event-types";
import { validateInboundN8nWebhook } from "../security/n8n-webhook-security";
import {
  getWorkflowRun,
  getWorkflowRunByJobId,
  transitionWorkflowRun,
} from "../workflows/workflow-status-tracker";
import { resumeWorkflowAfterHumanApproval } from "../workflows/human-approval-bridge";

export type N8nCallbackHandleResult = {
  ok: boolean;
  jobId?: string;
  runId?: string;
  reason?: string;
};

function mapCallbackStatus(status: N8nCallbackPayload["status"]): "success" | "failed" | "partial" | "running" {
  if (status === "success") return "success";
  if (status === "partial") return "partial";
  if (status === "running") return "running";
  return "failed";
}

/**
 * Traite les callbacks n8n (success / failure / partial) et synchronise queue + supervision.
 */
export async function handleN8nCallback(args: {
  payload: N8nCallbackPayload;
  rawBody: string;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
}): Promise<N8nCallbackHandleResult> {
  const validation = validateInboundN8nWebhook({
    rawBody: args.rawBody,
    signatureHeader: args.signatureHeader,
    timestampHeader: args.timestampHeader,
  });
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  const { payload } = args;
  const jobId = String(payload.jobId ?? "").trim();
  if (!jobId) return { ok: false, reason: "missing_job_id" };

  const job = getAutomationJob(jobId);
  const run =
    (payload.runId ? getWorkflowRun(payload.runId) : undefined) ?? getWorkflowRunByJobId(jobId);

  const mapped = mapCallbackStatus(payload.status);

  if (run) {
    transitionWorkflowRun(run.runId, mapped === "success" ? "success" : mapped === "partial" ? "partial" : mapped === "running" ? "running" : "failed", {
      lastError: payload.error,
      partialSteps: payload.partialSteps,
      completedSteps: payload.completedSteps,
      metadata: { callbackMessage: payload.message, ...(payload.data ?? {}) },
    });
  }

  if (!job) {
    logAutomation({
      level: "warn",
      event: "followup.required",
      message: "n8n_callback_job_not_found",
      meta: { jobId, runId: run?.runId, status: payload.status },
    });
    return { ok: true, jobId, runId: run?.runId, reason: "job_not_found_run_updated" };
  }

  if (mapped === "running") {
    setAutomationJobStatus(job, "executing");
    appendAutomationJobLog(job, "n8n_callback_running");
    return { ok: true, jobId, runId: run?.runId };
  }

  if (mapped === "success") {
    setAutomationJobStatus(job, "completed");
    appendAutomationJobLog(job, `n8n_callback_success: ${payload.message ?? "ok"}`);
    logAutomation({
      level: "info",
      event: job.event,
      message: "n8n_callback_success",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId, runId: run?.runId },
    });
    return { ok: true, jobId, runId: run?.runId };
  }

  if (mapped === "partial") {
    setAutomationJobStatus(job, "processing");
    appendAutomationJobLog(job, `n8n_callback_partial: ${(payload.completedSteps ?? []).join(",")}`);
    return { ok: true, jobId, runId: run?.runId };
  }

  job.lastError = payload.error ?? payload.message ?? "n8n_reported_failure";
  if (job.attempts >= (job.maxAttempts ?? 3)) {
    setAutomationJobStatus(job, "failed");
  } else {
    setAutomationJobStatus(job, "retrying");
    job.nextRetryAt = new Date(Date.now() + 1500 * job.attempts).toISOString();
  }
  appendAutomationJobLog(job, `n8n_callback_failed: ${job.lastError}`);

  logAutomation({
    level: "error",
    event: job.event,
    message: "n8n_callback_failure",
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    meta: { jobId, error: job.lastError, runId: run?.runId },
  });

  return { ok: true, jobId, runId: run?.runId };
}

/** Validation admin → reprise workflow n8n. */
export async function handleN8nHumanApprovalCallback(args: {
  jobId: string;
  choice: "send" | "modify" | "cancel";
}): Promise<N8nCallbackHandleResult> {
  const out = await resumeWorkflowAfterHumanApproval(args);
  if (args.choice === "cancel") {
    return { ok: true, jobId: args.jobId, reason: "cancelled" };
  }
  return { ok: out.dispatched, jobId: args.jobId, runId: out.runId, reason: out.error };
}

export function parseN8nCallbackBody(body: unknown): N8nCallbackPayload | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const jobId = String(o.jobId ?? o.job_id ?? "").trim();
  if (!jobId) return null;
  const statusRaw = String(o.status ?? "success").toLowerCase();
  const status =
    statusRaw === "failure" || statusRaw === "failed"
      ? "failure"
      : statusRaw === "partial"
        ? "partial"
        : statusRaw === "running"
          ? "running"
          : "success";
  return {
    jobId,
    runId: typeof o.runId === "string" ? o.runId : typeof o.run_id === "string" ? o.run_id : undefined,
    status,
    workflowKind: o.workflowKind as N8nCallbackPayload["workflowKind"],
    workflowSlug: typeof o.workflowSlug === "string" ? o.workflowSlug : undefined,
    message: typeof o.message === "string" ? o.message : undefined,
    error: typeof o.error === "string" ? o.error : undefined,
    partialSteps: Array.isArray(o.partialSteps) ? o.partialSteps.map(String) : undefined,
    completedSteps: Array.isArray(o.completedSteps) ? o.completedSteps.map(String) : undefined,
    timestamp: typeof o.timestamp === "string" ? o.timestamp : undefined,
    data: o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : undefined,
  };
}
