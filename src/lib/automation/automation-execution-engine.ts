/**
 * Moteur d’exécution autonome — jobs programmés, relances, n8n, retries.
 * Fonctionne sans nouveau message prospect (cycle scheduler).
 */

import "server-only";

import type { AutomationActionJob } from "./action-queue";
import {
  appendAutomationJobLog,
  getAutomationJob,
  isAutomationDispatchSuccessStatus,
  listAllAutomationJobs,
  peekRunnableAutomationJobs,
  setAutomationJobStatus,
} from "./action-queue";
import { AUTOMATION_MAX_ATTEMPTS, computeNextRetryAtIso } from "./automation-retry";
import { evaluateAutomationSafety } from "./automation-safety";
import {
  evaluateAutonomousAutomationDecision,
  formatAutonomousDecisionForLog,
} from "./autonomous-decision-engine";
import { flushQueuedEventToN8n } from "./integrations/n8n-webhook-client";
import { conversationContextFromQueuePayload } from "./payloads/n8n-production-payload";
import { logAutomation } from "./event-log";
import { peekPendingEvents } from "./event-queue";
import { processDueAgentFollowups } from "@/lib/agents/followups/process-agent-followups";

const SESSION_OUTBOUND_COOLDOWN_MS = Number(process.env.OPTIMA_AUTOMATION_COOLDOWN_MS ?? "300000");
const lastOutboundBySession = new Map<string, number>();

export type AutomationExecutionCycleStats = {
  ok: boolean;
  actionJobsExecuted: number;
  actionJobsDeferred: number;
  actionJobsFailed: number;
  n8nEventsFlushed: number;
  chatFollowupsProcessed: number;
  errors: string[];
};

export type ExecuteJobResult =
  | { ok: true; status: AutomationActionJob["status"] }
  | { ok: false; reason: string; deferred?: boolean; resumeAt?: string };

function isRunnableStatus(status: AutomationActionJob["status"]): boolean {
  return status === "pending" || status === "scheduled" || status === "retrying";
}

function normalizeLegacyProcessing(job: AutomationActionJob) {
  if (job.status === "processing") {
    job.status = "executing";
    appendAutomationJobLog(job, "status_normalized_processing_to_executing");
  }
}

function sessionCooldownOk(sessionId: string): { ok: true } | { ok: false; reason: string } {
  const last = lastOutboundBySession.get(sessionId);
  if (last && Date.now() - last < SESSION_OUTBOUND_COOLDOWN_MS) {
    return { ok: false, reason: "session_cooldown" };
  }
  return { ok: true };
}

function touchSessionCooldown(sessionId: string) {
  lastOutboundBySession.set(sessionId, Date.now());
  if (lastOutboundBySession.size > 5000) {
    const cutoff = Date.now() - SESSION_OUTBOUND_COOLDOWN_MS * 2;
    for (const [k, t] of lastOutboundBySession) {
      if (t < cutoff) lastOutboundBySession.delete(k);
    }
  }
}

async function dispatchJobToN8n(job: AutomationActionJob): Promise<{ ok: boolean; error?: string; status?: number }> {
  const { dispatchN8nAction } = await import("@/lib/n8n/dispatch/n8n-action-dispatcher");
  const out = await dispatchN8nAction(job);
  return { ok: out.ok, error: out.error, status: out.httpStatus };
}

/**
 * Exécute une job : sécurité → horaires → cooldown → n8n → statut final.
 */
export async function executeAutomationJob(jobId: string): Promise<ExecuteJobResult> {
  const job = getAutomationJob(jobId);
  if (!job) return { ok: false, reason: "job_not_found" };

  normalizeLegacyProcessing(job);

  if (!isRunnableStatus(job.status)) {
    return { ok: false, reason: `not_runnable_${job.status}` };
  }

  const now = Date.now();
  if (job.scheduledFor && Date.parse(job.scheduledFor) > now) {
    return { ok: false, reason: "not_due_yet", deferred: true, resumeAt: job.scheduledFor };
  }
  if (job.status === "retrying" && job.nextRetryAt && Date.parse(job.nextRetryAt) > now) {
    return { ok: false, reason: "retry_backoff", deferred: true, resumeAt: job.nextRetryAt };
  }

  const autonomous = evaluateAutonomousAutomationDecision({
    ctx: job.ctx,
    intent: job.intent,
    routedChannel: job.routedChannel,
    isAutonomousFollowup: Boolean(job.scheduledFor) || job.executionPath === "standard",
  });

  appendAutomationJobLog(job, `autonomous_decision: ${formatAutonomousDecisionForLog(autonomous)}`);

  logAutomation({
    level: autonomous.state === "BLOCK" ? "warn" : "info",
    event: job.event,
    message: `autonomous_decision_${autonomous.state.toLowerCase()}`,
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    meta: { jobId: job.id, ...autonomous.factors, reasons: autonomous.reasons },
  });

  if (autonomous.state === "BLOCK") {
    setAutomationJobStatus(job, "blocked");
    job.lastError = autonomous.reasons.join("; ");
    appendAutomationJobLog(job, "blocked_autonomous_decision");
    return { ok: false, reason: "autonomous_blocked" };
  }

  if (autonomous.state === "DELAY" && autonomous.resumeAt) {
    job.scheduledFor = autonomous.resumeAt;
    setAutomationJobStatus(job, "scheduled");
    appendAutomationJobLog(job, `deferred_autonomous_until_${autonomous.resumeAt}`);
    return { ok: false, reason: "autonomous_delayed", deferred: true, resumeAt: autonomous.resumeAt };
  }

  if (autonomous.state === "SOFT_ACTION") {
    appendAutomationJobLog(job, "soft_action_mode_human_tone");
    const aggressive =
      job.intent?.actionType === "CREATE_ORDER_DRAFT" ||
      job.intent?.actionType === "SEND_WHATSAPP_FOLLOWUP";
    if (aggressive && job.executionPath !== "soft_fallback") {
      const resumeAt = autonomous.resumeAt ?? computeNextRetryAtIso(1);
      job.scheduledFor = resumeAt;
      setAutomationJobStatus(job, "scheduled");
      appendAutomationJobLog(job, "soft_only_deferred_aggressive_action");
      return { ok: false, reason: "soft_action_no_hard_sell", deferred: true, resumeAt };
    }
  }

  const safety = evaluateAutomationSafety({
    sessionId: job.ctx.sessionId,
    agentId: job.ctx.agentId,
    businessIanaTimezone: job.ctx.businessIanaTimezone,
    idempotencyKey: job.idempotencyKey,
    intent: job.intent,
    ctx: job.ctx,
  });

  if (!safety.ok) {
    if (safety.reason === "quiet_hours" || safety.reason === "aggressive_followup_blocked") {
      const resumeAt = autonomous.resumeAt ?? computeNextRetryAtIso(1);
      if (resumeAt) {
        job.scheduledFor = resumeAt;
        setAutomationJobStatus(job, "scheduled");
        appendAutomationJobLog(job, `deferred_safety_${safety.reason}_until_${resumeAt}`);
        return { ok: false, reason: safety.reason, deferred: true, resumeAt };
      }
    }
    if (safety.reason !== "duplicate") {
      setAutomationJobStatus(job, "blocked");
      job.lastError = safety.reason;
      appendAutomationJobLog(job, `blocked_${safety.reason}`);
    }
    return { ok: false, reason: safety.reason };
  }

  const cooldown = sessionCooldownOk(job.ctx.sessionId);
  if (!cooldown.ok) {
    const resumeAt = computeNextRetryAtIso(1);
    job.nextRetryAt = resumeAt;
    setAutomationJobStatus(job, "retrying");
    appendAutomationJobLog(job, `deferred_${cooldown.reason}`);
    return { ok: false, reason: cooldown.reason, deferred: true, resumeAt };
  }

  setAutomationJobStatus(job, "executing");
  appendAutomationJobLog(job, "executing_start");

  const res = await dispatchJobToN8n(job);
  job.attempts += 1;
  touchSessionCooldown(job.ctx.sessionId);

  if (res.ok) {
    if (job.executionPath === "auto_hot") {
      setAutomationJobStatus(job, "auto_executed");
      appendAutomationJobLog(job, `auto_executed_status_${res.status ?? "ok"}`);
    } else if (job.executionPath === "soft_fallback") {
      setAutomationJobStatus(job, "soft_executed");
      appendAutomationJobLog(job, `soft_executed_status_${res.status ?? "ok"}`);
    } else {
      setAutomationJobStatus(job, "completed");
      appendAutomationJobLog(job, `completed_status_${res.status ?? "ok"}`);
    }
    logAutomation({
      level: "info",
      event: job.event,
      message: "autonomous_execution_ok",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId: job.id, status: job.status, attempts: job.attempts },
    });
    return { ok: true, status: job.status };
  }

  job.lastError = res.error;
  appendAutomationJobLog(job, `failed_attempt_${job.attempts}: ${res.error}`);

  if (job.attempts >= (job.maxAttempts || AUTOMATION_MAX_ATTEMPTS)) {
    setAutomationJobStatus(job, "failed");
    logAutomation({
      level: "error",
      event: job.event,
      message: "autonomous_execution_failed_terminal",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId: job.id, error: res.error },
    });
    return { ok: false, reason: res.error ?? "n8n_failed" };
  }

  job.nextRetryAt = computeNextRetryAtIso(job.attempts);
  setAutomationJobStatus(job, "retrying");
  logAutomation({
    level: "warn",
    event: job.event,
    message: "autonomous_execution_retry_scheduled",
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    meta: { jobId: job.id, attempt: job.attempts, nextRetryAt: job.nextRetryAt },
  });
  return { ok: false, reason: res.error ?? "n8n_failed", deferred: true, resumeAt: job.nextRetryAt };
}

export async function scanAndExecuteAutomationJobs(limit = 20): Promise<{
  executed: number;
  deferred: number;
  failed: number;
}> {
  let executed = 0;
  let deferred = 0;
  let failed = 0;

  const runnable = peekRunnableAutomationJobs(limit);
  for (const job of runnable) {
    const out = await executeAutomationJob(job.id);
    if (out.ok) executed += 1;
    else if (out.deferred) deferred += 1;
    else failed += 1;
  }

  return { executed, deferred, failed };
}

async function flushPendingN8nEvents(limit: number): Promise<number> {
  let ok = 0;
  for (const row of peekPendingEvents(limit)) {
    if (await flushQueuedEventToN8n(row, conversationContextFromQueuePayload(row))) ok += 1;
  }
  return ok;
}

/**
 * Cycle autonome — à appeler toutes les 30s–60s (cron).
 * Traite : jobs action-queue, événements n8n en file, relances chat DB.
 */
export async function runAutomationExecutionCycle(opts?: {
  maxActionJobs?: number;
  maxN8nEvents?: number;
  maxChatFollowups?: number;
}): Promise<AutomationExecutionCycleStats> {
  const errors: string[] = [];
  const maxActionJobs = opts?.maxActionJobs ?? 20;
  const maxN8nEvents = opts?.maxN8nEvents ?? 15;
  const maxChatFollowups = opts?.maxChatFollowups ?? 25;

  let actionJobsExecuted = 0;
  let actionJobsDeferred = 0;
  let actionJobsFailed = 0;
  let n8nEventsFlushed = 0;
  let chatFollowupsProcessed = 0;

  try {
    const scan = await scanAndExecuteAutomationJobs(maxActionJobs);
    actionJobsExecuted = scan.executed;
    actionJobsDeferred = scan.deferred;
    actionJobsFailed = scan.failed;
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    n8nEventsFlushed = await flushPendingN8nEvents(maxN8nEvents);
  } catch (e) {
    errors.push(`n8n_events: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const fu = await processDueAgentFollowups({ max: maxChatFollowups });
    if (fu.ok) chatFollowupsProcessed = fu.processed;
    else errors.push("chat_followups_failed");
  } catch (e) {
    errors.push(`followups: ${e instanceof Error ? e.message : String(e)}`);
  }

  logAutomation({
    level: "info",
    event: "followup.required",
    message: "automation_execution_cycle_complete",
    meta: {
      actionJobsExecuted,
      actionJobsDeferred,
      actionJobsFailed,
      n8nEventsFlushed,
      chatFollowupsProcessed,
      queueSize: listAllAutomationJobs().length,
    },
  });

  return {
    ok: errors.length === 0,
    actionJobsExecuted,
    actionJobsDeferred,
    actionJobsFailed,
    n8nEventsFlushed,
    chatFollowupsProcessed,
    errors,
  };
}

export { isAutomationDispatchSuccessStatus };
