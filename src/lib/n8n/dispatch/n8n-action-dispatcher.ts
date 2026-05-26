import "server-only";

import type { AutomationActionJob } from "@/lib/automation/action-queue";
import { logAutomation } from "@/lib/automation/event-log";
import { dispatchN8nWebhook } from "@/lib/automation/integrations/n8n-connection-manager";
import {
  buildHotProspectPayload,
  buildNormalizedN8nPayload,
} from "@/lib/automation/payloads/n8n-production-payload";
import {
  canExecuteAutomationAction,
  inputFromAutomationContext,
  recordAutomationExecution,
  resolveActionChannelFromEvent,
} from "@/lib/automation/rate-limit/automation-rate-limiter";

import { mapAutomationIntentToWorkflow, mapIntentToWorkflow } from "../mapping/workflow-mapping-engine";
import { planN8nRetry, shouldRetryN8nDispatch } from "../retry/n8n-retry-policy";
import {
  createWorkflowRun,
  getWorkflowRunByJobId,
  incrementWorkflowRunAttempt,
  transitionWorkflowRun,
} from "../workflows/workflow-status-tracker";

export type N8nDispatchResult = {
  ok: boolean;
  runId: string;
  status: "success" | "failed" | "retrying";
  error?: string;
  httpStatus?: number;
  attempt: number;
  workflowSlug: string;
  workflowKind: string;
};

/**
 * Envoie une job automation vers n8n — payload unique normalisé, retries, suivi statut.
 */
export async function dispatchN8nAction(job: AutomationActionJob): Promise<N8nDispatchResult> {
  if (job.status === "awaiting_human") {
    const run = createWorkflowRun({
      jobId: job.id,
      workflowKind: "generic_automation",
      workflowSlug: job.intent?.suggestedWorkflow ?? "awaiting-human",
      status: "awaiting_human",
      sessionId: job.ctx.sessionId,
      agentId: job.ctx.agentId,
      conversationId: job.ctx.conversationId,
      requiresApproval: true,
    });
    return {
      ok: false,
      runId: run.runId,
      status: "failed",
      error: "awaiting_human_approval",
      attempt: 0,
      workflowSlug: run.workflowSlug,
      workflowKind: run.workflowKind,
    };
  }

  const mapping = job.intent
    ? mapAutomationIntentToWorkflow(job.intent)
    : mapIntentToWorkflow({
        actionType: job.event,
        leadTemperature: job.ctx.leadTemperature ?? job.ctx.prospectLead?.leadTemperature,
      });

  let run = getWorkflowRunByJobId(job.id);
  if (!run) {
    run = createWorkflowRun({
      jobId: job.id,
      workflowKind: mapping.workflowKind,
      workflowSlug: mapping.workflowSlug,
      status: "queued",
      sessionId: job.ctx.sessionId,
      agentId: job.ctx.agentId,
      conversationId: job.ctx.conversationId,
      requiresApproval: job.requiresHumanApproval,
      metadata: { intent: mapping.intent, agentName: job.ctx.agentName },
    });
  }

  const rateInput = inputFromAutomationContext(job.ctx, {
    actionType: job.intent?.actionType,
    actionChannel: resolveActionChannelFromEvent(
      mapping.event,
      job.routedChannel ?? undefined,
    ),
    event: mapping.event,
    workflowSlug: mapping.workflowSlug,
  });

  const rateGate = await canExecuteAutomationAction(rateInput);
  if (!rateGate.allowed) {
    transitionWorkflowRun(run.runId, "failed", {
      lastError: rateGate.reason ?? "rate_limited",
    });
    logAutomation({
      level: "info",
      event: mapping.event,
      message: "n8n_dispatch_skipped_rate_limit",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: {
        jobId: job.id,
        reason: rateGate.reason,
        remainingCooldownMs: rateGate.remainingCooldownMs,
        cooldownUntil: rateGate.cooldownUntil,
      },
    });
    return {
      ok: false,
      runId: run.runId,
      status: "failed",
      error: rateGate.reason ?? "rate_limited",
      attempt: run.attempts,
      workflowSlug: mapping.workflowSlug,
      workflowKind: mapping.workflowKind,
    };
  }

  transitionWorkflowRun(run.runId, "running");
  incrementWorkflowRunAttempt(run.runId);

  const attempt = run.attempts;
  const isHot =
    job.event === "lead.hot" ||
    mapping.intent === "HOT_PROSPECT_DETECTED" ||
    job.ctx.leadTemperature === "hot";

  const normalizedPayload = isHot
    ? buildHotProspectPayload(job, {
        runId: run.runId,
        workflowSlug: mapping.workflowSlug,
        workflowKind: mapping.workflowKind,
      })
    : buildNormalizedN8nPayload(job, {
        runId: run.runId,
        workflowSlug: mapping.workflowSlug,
        workflowKind: mapping.workflowKind,
      });

  logAutomation({
    level: "info",
    event: normalizedPayload.event as AutomationActionJob["event"],
    message: "n8n_dispatch_start",
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    meta: {
      jobId: job.id,
      runId: run.runId,
      workflowSlug: mapping.workflowSlug,
      attempt,
      conversationId: normalizedPayload.conversation.conversationId,
      scheduledFor: normalizedPayload.automation.scheduledFor,
    },
  });

  const connectionRes = await dispatchN8nWebhook(normalizedPayload, {
    event: normalizedPayload.event,
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    idempotencyKey: job.idempotencyKey,
    fallbackQueue: true,
  });

  if (connectionRes.ok) {
    await recordAutomationExecution(rateInput);
    transitionWorkflowRun(run.runId, "success");
    logAutomation({
      level: "info",
      event: normalizedPayload.event as AutomationActionJob["event"],
      message: "n8n_dispatch_ok",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId: job.id, runId: run.runId, attempt },
    });
    return {
      ok: true,
      runId: run.runId,
      status: "success",
      attempt,
      httpStatus: connectionRes.status,
      workflowSlug: mapping.workflowSlug,
      workflowKind: mapping.workflowKind,
    };
  }

  const error = connectionRes.error ?? "n8n_dispatch_failed";
  if (shouldRetryN8nDispatch(attempt, error)) {
    const plan = planN8nRetry(attempt);
    transitionWorkflowRun(run.runId, "retrying", { lastError: error });
    logAutomation({
      level: "warn",
      event: normalizedPayload.event as AutomationActionJob["event"],
      message: "n8n_dispatch_retry",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId: job.id, runId: run.runId, attempt, nextRetryAt: plan.nextRetryAt, error },
    });
    return {
      ok: false,
      runId: run.runId,
      status: "retrying",
      error,
      attempt,
      workflowSlug: mapping.workflowSlug,
      workflowKind: mapping.workflowKind,
    };
  }

  transitionWorkflowRun(run.runId, "failed", { lastError: error });
  logAutomation({
    level: "error",
    event: normalizedPayload.event as AutomationActionJob["event"],
    message: "n8n_dispatch_failed",
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    meta: { jobId: job.id, runId: run.runId, attempt, error },
  });

  return {
    ok: false,
    runId: run.runId,
    status: "failed",
    error,
    attempt,
    workflowSlug: mapping.workflowSlug,
    workflowKind: mapping.workflowKind,
  };
}
