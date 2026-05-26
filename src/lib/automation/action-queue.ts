/**
 * File centrale des actions automation — audit, retry, file d’attente unique.
 */

import "server-only";

import { computeLeadPriorityScore, isHotAutoBypassAction, softFallbackCopy } from "./automation-priority-engine";
import type { AutomationIntentSignal } from "./automation-intent-engine";
import { evaluateAutomationSafety } from "./automation-safety";
import { dispatchN8nWebhook } from "./integrations/n8n-connection-manager";
import { buildNormalizedN8nPayload } from "./payloads/n8n-production-payload";
import {
  canExecuteAutomationAction,
  inputFromAutomationContext,
} from "./rate-limit/automation-rate-limiter";
import type { LeadPriorityBand } from "./automation-priority-engine";
import { logAutomation } from "./event-log";
import type { AutomationEventName, ConversationAutomationContext } from "./types";
import type { ExecutionChannel } from "./execution-types";

export type AutomationActionJobStatus =
  | "pending"
  | "scheduled"
  | "executing"
  | "processing"
  | "completed"
  | "failed"
  | "retrying"
  | "cancelled"
  | "awaiting_human"
  | "auto_executed"
  | "soft_executed"
  | "blocked";

export type AutomationExecutionPath = "standard" | "auto_hot" | "soft_fallback";

export type AutomationActionJob = {
  id: string;
  createdAt: string;
  status: AutomationActionJobStatus;
  event: AutomationEventName;
  attempts: number;
  maxAttempts: number;
  intent?: AutomationIntentSignal;
  requiresHumanApproval: boolean;
  ctx: ConversationAutomationContext;
  logTrail: string[];
  lastError?: string;
  idempotencyKey?: string;
  routedChannel?: ExecutionChannel;
  /** Score 0–100 issu de automation-priority-engine. */
  priorityScore?: number;
  priorityBand?: LeadPriorityBand;
  executionPath?: AutomationExecutionPath;
  /** ISO — exécution différée (relance autonome). */
  scheduledFor?: string;
  /** ISO — prochain essai après échec (backoff). */
  nextRetryAt?: string;
};

const jobs: AutomationActionJob[] = [];
const MAX_JOBS = 3000;

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `aj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pushLog(job: AutomationActionJob, line: string) {
  job.logTrail.push(`${new Date().toISOString()} ${line}`);
  if (job.logTrail.length > 80) job.logTrail.shift();
}

export function appendAutomationJobLog(job: AutomationActionJob, line: string) {
  pushLog(job, line);
}

export function setAutomationJobStatus(job: AutomationActionJob, status: AutomationActionJobStatus) {
  job.status = status;
}

export function listAllAutomationJobs(): AutomationActionJob[] {
  return jobs;
}

function isJobDue(job: AutomationActionJob, now: number): boolean {
  if (job.scheduledFor && Date.parse(job.scheduledFor) > now) return false;
  if (job.status === "retrying" && job.nextRetryAt && Date.parse(job.nextRetryAt) > now) return false;
  return true;
}

/** Jobs prêtes : pending / scheduled (échéance passée) / retrying (backoff écoulé). */
export function peekRunnableAutomationJobs(limit = 25): AutomationActionJob[] {
  const now = Date.now();
  return jobs
    .filter((j) => {
      if (j.status === "pending" || j.status === "scheduled" || j.status === "retrying") {
        return isJobDue(j, now);
      }
      return false;
    })
    .slice(0, limit);
}

export function isAutomationDispatchSuccessStatus(status: AutomationActionJobStatus | undefined): boolean {
  return status === "completed" || status === "auto_executed";
}

function recordBlockedAutomationJob(args: {
  event: AutomationEventName;
  ctx: ConversationAutomationContext;
  intent?: AutomationIntentSignal | null;
  reason: string;
  routedChannel?: ExecutionChannel;
}) {
  const pr = computeLeadPriorityScore(args.ctx, args.intent ?? null);
  const job: AutomationActionJob = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: "blocked",
    event: args.event,
    attempts: 0,
    maxAttempts: 0,
    intent: args.intent ?? undefined,
    requiresHumanApproval: false,
    ctx: args.ctx,
    logTrail: [],
    lastError: args.reason,
    routedChannel: args.routedChannel,
    priorityScore: pr.score,
    priorityBand: pr.band,
    executionPath: "standard",
  };
  pushLog(job, `blocked_${args.reason}`);
  jobs.push(job);
  if (jobs.length > MAX_JOBS) jobs.shift();
  logAutomation({
    level: "warn",
    event: args.event,
    message: "action_job_blocked_audit",
    agentId: args.ctx.agentId,
    sessionId: args.ctx.sessionId,
    meta: { jobId: job.id, reason: args.reason },
  });
}

export async function enqueueAutomationAction(args: {
  event: AutomationEventName;
  ctx: ConversationAutomationContext;
  intent?: AutomationIntentSignal | null;
  idempotencyKey?: string;
  forceHumanGate?: boolean;
  humanGateSatisfied?: boolean;
  routedChannel?: ExecutionChannel;
  /** Si défini et dans le futur → statut `scheduled` (exécution autonome plus tard). */
  scheduledFor?: string;
}): Promise<AutomationActionJob | null> {
  const priority = computeLeadPriorityScore(args.ctx, args.intent ?? null);

  const hotBypass =
    priority.score >= 85 &&
    Boolean(args.intent) &&
    isHotAutoBypassAction(args.intent!.actionType) &&
    args.forceHumanGate !== true;

  let requiresHuman = false;
  if (args.forceHumanGate === true) {
    requiresHuman = true;
  } else if (hotBypass) {
    requiresHuman = false;
  } else if (priority.band === "cold") {
    requiresHuman = false;
  } else {
    requiresHuman = args.intent?.requiresApproval === true && args.humanGateSatisfied !== true;
  }

  if (!requiresHuman) {
    const rateGate = await canExecuteAutomationAction(
      inputFromAutomationContext(args.ctx, {
        actionType: args.intent?.actionType,
        event: args.event,
        workflowSlug: args.intent?.suggestedWorkflow,
      }),
    );
    if (!rateGate.allowed) {
      logAutomation({
        level: "info",
        event: args.event,
        message: "action_queue_rate_limited",
        agentId: args.ctx.agentId,
        sessionId: args.ctx.sessionId,
        meta: { reason: rateGate.reason, cooldownUntil: rateGate.cooldownUntil },
      });
      return null;
    }
  }

  const safety = evaluateAutomationSafety({
    sessionId: args.ctx.sessionId,
    agentId: args.ctx.agentId,
    businessIanaTimezone: args.ctx.businessIanaTimezone,
    idempotencyKey: args.idempotencyKey,
    intent: requiresHuman ? null : args.intent,
    ctx: args.ctx,
  });

  if (!safety.ok) {
    if (safety.reason !== "duplicate") {
      recordBlockedAutomationJob({
        event: args.event,
        ctx: args.ctx,
        intent: args.intent,
        reason: safety.reason,
        routedChannel: args.routedChannel,
      });
    }
    logAutomation({
      level: "warn",
      event: args.event,
      message: `action_queue_blocked_${safety.reason}`,
      agentId: args.ctx.agentId,
      sessionId: args.ctx.sessionId,
      meta: { reason: safety.reason },
    });
    return null;
  }

  const executionPath: AutomationExecutionPath = hotBypass ? "auto_hot" : "standard";

  const scheduledMs = args.scheduledFor ? Date.parse(args.scheduledFor) : 0;
  const isFutureSchedule = Number.isFinite(scheduledMs) && scheduledMs > Date.now();

  let initialStatus: AutomationActionJobStatus;
  if (requiresHuman) initialStatus = "awaiting_human";
  else if (isFutureSchedule) initialStatus = "scheduled";
  else initialStatus = "pending";

  const job: AutomationActionJob = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: initialStatus,
    event: args.event,
    attempts: 0,
    maxAttempts: 3,
    intent: args.intent ?? undefined,
    requiresHumanApproval: requiresHuman,
    ctx: args.ctx,
    logTrail: [],
    idempotencyKey: args.idempotencyKey,
    routedChannel: args.routedChannel,
    priorityScore: priority.score,
    priorityBand: priority.band,
    executionPath,
    scheduledFor: args.scheduledFor,
  };

  if (requiresHuman) {
    pushLog(job, "enqueued_awaiting_human");
  } else if (isFutureSchedule) {
    pushLog(job, `enqueued_scheduled_for_${args.scheduledFor}`);
  } else if (hotBypass) {
    pushLog(job, "enqueued_auto_hot_pending_dispatch");
  } else {
    pushLog(job, "enqueued_pending");
  }

  jobs.push(job);
  if (jobs.length > MAX_JOBS) jobs.shift();

  if (!requiresHuman) {
    const { evaluateAutonomousAutomationDecision, formatAutonomousDecisionForLog } = await import(
      "./autonomous-decision-engine"
    );
    const decision = evaluateAutonomousAutomationDecision({
      ctx: args.ctx,
      intent: args.intent ?? null,
      routedChannel: args.routedChannel,
      isAutonomousFollowup: isFutureSchedule,
    });
    pushLog(job, `autonomous_enqueue: ${formatAutonomousDecisionForLog(decision)}`);

    if (decision.state === "BLOCK") {
      job.status = "blocked";
      job.lastError = decision.reasons.join("; ");
      pushLog(job, "blocked_at_enqueue_autonomous");
      return job;
    }
    if (decision.state === "DELAY" && decision.resumeAt) {
      job.status = "scheduled";
      job.scheduledFor = decision.resumeAt;
      pushLog(job, `scheduled_at_enqueue_${decision.resumeAt}`);
    }
  }

  logAutomation({
    level: "info",
    event: args.event,
    message: requiresHuman ? "action_job_queued_human" : hotBypass ? "action_job_queued_auto_hot" : "action_job_queued",
    agentId: args.ctx.agentId,
    sessionId: args.ctx.sessionId,
    meta: {
      jobId: job.id,
      intent: args.intent?.actionType,
      priorityScore: priority.score,
      priorityBand: priority.band,
      hotBypass,
    },
  });

  if (hotBypass && job.status === "pending" && !isFutureSchedule) {
    pushLog(job, "auto_hot_immediate_dispatch");
    await processAutomationActionJob(job.id);
  }

  return job;
}

/** Planifie une action autonome à une date ISO (relance email / WhatsApp sans nouveau message). */
export async function scheduleAutomationAction(
  args: Parameters<typeof enqueueAutomationAction>[0] & { scheduledFor: string },
): Promise<AutomationActionJob | null> {
  return enqueueAutomationAction(args);
}

export function peekPendingAutomationJobs(limit = 25): AutomationActionJob[] {
  return jobs.filter((j) => j.status === "pending").slice(0, limit);
}

export function peekAwaitingHumanJobs(limit = 25): AutomationActionJob[] {
  return jobs.filter((j) => j.status === "awaiting_human").slice(0, limit);
}

export function getAutomationJob(id: string): AutomationActionJob | undefined {
  return jobs.find((j) => j.id === id);
}

export function resolveAutomationJobHumanApproval(args: {
  jobId: string;
  choice: "send" | "modify" | "cancel";
}): AutomationActionJob | null {
  const job = jobs.find((j) => j.id === args.jobId);
  if (!job || job.status !== "awaiting_human") return null;

  if (args.choice === "cancel") {
    job.status = "cancelled";
    pushLog(job, "human_choice_cancel");
    return job;
  }

  job.status = "pending";
  job.executionPath = "standard";
  pushLog(job, args.choice === "send" ? "human_choice_send_release" : "human_choice_modify_requeued");
  return job;
}

export async function processAutomationActionJob(jobId: string): Promise<boolean> {
  const { executeAutomationJob } = await import("./automation-execution-engine");
  const result = await executeAutomationJob(jobId);
  return result.ok;
}

/** @deprecated Préférer `scanAndExecuteAutomationJobs` via le cycle autonome. */
export async function flushPendingAutomationJobs(limit = 10): Promise<number> {
  const { scanAndExecuteAutomationJobs } = await import("./automation-execution-engine");
  const r = await scanAndExecuteAutomationJobs(limit);
  return r.executed;
}

/**
 * Si les jobs restent trop longtemps en `awaiting_human`, envoi d’un message d’accusé réception
 * (payload n8n) sans bloquer le client.
 */
export async function sweepAwaitingHumanSoftFallback(args: { maxAgeMs: number }): Promise<number> {
  const now = Date.now();
  let count = 0;

  const stale = jobs.filter((j) => {
    if (j.status !== "awaiting_human") return false;
    return now - new Date(j.createdAt).getTime() >= args.maxAgeMs;
  });

  for (const job of stale) {
    job.status = "executing";
    job.executionPath = "soft_fallback";
    pushLog(job, "soft_fallback_admin_timeout");
    const msg = softFallbackCopy(job.ctx.lang);

    const normalized = buildNormalizedN8nPayload(job, { softFallbackMessage: msg });
    const res = await dispatchN8nWebhook(normalized, {
      event: normalized.event,
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      idempotencyKey: job.idempotencyKey,
      fallbackQueue: false,
    });

    job.attempts += 1;
    job.lastError = res.ok ? undefined : res.error;
    job.status = "soft_executed";
    pushLog(job, res.ok ? "soft_executed_n8n_ok" : `soft_executed_n8n_fail: ${res.error ?? "unknown"}`);

    logAutomation({
      level: res.ok ? "info" : "warn",
      event: job.event,
      message: res.ok ? "soft_fallback_sent" : "soft_fallback_n8n_failed",
      agentId: job.ctx.agentId,
      sessionId: job.ctx.sessionId,
      meta: { jobId: job.id, error: res.error },
    });

    count += 1;
  }

  return count;
}

export function getAutomationActionQueueDepth(): {
  pending: number;
  scheduled: number;
  executing: number;
  retrying: number;
  awaitingHuman: number;
  blocked: number;
  autoExecuted: number;
  softExecuted: number;
  completed: number;
  failed: number;
} {
  return {
    pending: jobs.filter((j) => j.status === "pending").length,
    scheduled: jobs.filter((j) => j.status === "scheduled").length,
    executing: jobs.filter((j) => j.status === "executing" || j.status === "processing").length,
    retrying: jobs.filter((j) => j.status === "retrying").length,
    awaitingHuman: jobs.filter((j) => j.status === "awaiting_human").length,
    blocked: jobs.filter((j) => j.status === "blocked").length,
    autoExecuted: jobs.filter((j) => j.status === "auto_executed").length,
    softExecuted: jobs.filter((j) => j.status === "soft_executed").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };
}
