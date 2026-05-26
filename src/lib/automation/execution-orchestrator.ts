/**
 * Orchestrateur d’exécution — intentions → actions business (sécurisé, observable, déterministe).
 */

import "server-only";

import { evaluateHumanApprovalGate } from "@/lib/agent-actions/permissions/human-approval-gate";
import type { AutomationIntentSignal } from "./automation-intent-engine";
import type { ConversationAutomationContext } from "./types";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { ChannelAvailability } from "./channel-router";
import type { ExecuteAutomationIntentResult, ExecutionChannel } from "./execution-types";
import { resolveExecutionChannel } from "./channel-router";
import { evaluateBusinessRules } from "./business-rules-engine";
import {
  mapAutomationIntentToAgentActionKind,
  resolveWorkflowRoute,
} from "./workflow-mapper";
import {
  createAutomationExecutionRecord,
  registerAutomationExecution,
  transitionAutomationExecution,
} from "./automation-state-machine";
import {
  enqueueAutomationAction,
  getAutomationJob,
  isAutomationDispatchSuccessStatus,
  processAutomationActionJob,
} from "./action-queue";
import { buildIdempotencyKey } from "./anti-duplicate";
import { appendAgentReasoningLog } from "./agent-reasoning-log";
import { formatLiveExecutionFeedback } from "./execution-feedback";
import { logExecutionObs } from "./execution-observability";
import { analyzeTriggerSignals } from "./triggers/trigger-signals";
import { computeLeadPriorityScore, isHotAutoBypassAction } from "./automation-priority-engine";

export type ExecuteAutomationIntentInput = {
  intent: AutomationIntentSignal;
  conversation: ConversationAutomationContext;
  prospect?: Partial<SmartProspectProfile> | null;
  agent?: { id?: string; displayName?: string };
  businessContext?: Record<string, unknown>;
  humanApproved?: boolean;
  executeImmediately?: boolean;
  channelAvailability?: ChannelAvailability;
};

function mergeCtx(
  conversation: ConversationAutomationContext,
  prospect?: Partial<SmartProspectProfile> | null,
  agent?: ExecuteAutomationIntentInput["agent"],
): ConversationAutomationContext {
  const baseLead = conversation.prospectLead;
  const mergedLead =
    prospect && baseLead
      ? { ...baseLead, ...prospect }
      : prospect
        ? { ...(baseLead ?? ({} as SmartProspectProfile)), ...prospect }
        : baseLead;
  return {
    ...conversation,
    prospectLead: mergedLead,
    agentId: agent?.id ?? conversation.agentId,
    agentName: agent?.displayName ?? conversation.agentName,
  };
}

/**
 * Point d’entrée production : vérifie règles, gate humain, enqueue, exécute optionnellement, journalise.
 */
export async function executeAutomationIntent(
  input: ExecuteAutomationIntentInput,
): Promise<ExecuteAutomationIntentResult> {
  const t0 = Date.now();
  const executionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `ex_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const logs: string[] = [];
  const lang = input.conversation.lang ?? "fr";

  const ctx = mergeCtx(input.conversation, input.prospect, input.agent);
  const route = resolveWorkflowRoute(input.intent);
  const channel = resolveExecutionChannel({
    intent: input.intent,
    ctx,
    availability: input.channelAvailability,
  });

  const record = createAutomationExecutionRecord({
    executionId,
    intentActionType: input.intent.actionType,
  });
  record.workflowUsed = route.workflowKey;
  record.channel = channel;
  registerAutomationExecution(record);

  const push = (line: string) => logs.push(`${new Date().toISOString()} ${line}`);

  push(`detected intent=${input.intent.actionType} workflow=${route.workflowKey} channel=${channel}`);

  const signals = analyzeTriggerSignals(ctx);
  appendAgentReasoningLog({
    executionId,
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    prospectHesitation: signals.priceAsked && !signals.purchaseIntent,
    interestScore: input.intent.confidence,
    actionChosen: input.intent.actionType,
    followupReason: input.intent.rationale,
    commercialStrategy: route.workflowKey,
    risksDetected: input.businessContext?.risks as string[] | undefined,
    notes: { channel, pipelineStage: ctx.pipelineStage },
  });

  const idempotencyKey = buildIdempotencyKey([
    "exec_intent",
    ctx.agentId,
    ctx.sessionId,
    input.intent.actionType,
    route.event,
    String(input.intent.confidence),
  ]);

  const rules = evaluateBusinessRules({
    ctx,
    intent: input.intent,
    channel,
    idempotencyKey,
    businessContext: input.businessContext,
  });

  if (!rules.ok) {
    transitionAutomationExecution(record, "failed", rules.reason);
    logExecutionObs({
      executionId,
      message: "business_rules_blocked",
      level: "warn",
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      to: "failed",
      error: rules.reason,
      meta: { flags: rules.flags },
    });
    push(`failed rules=${rules.reason}`);
    return {
      success: false,
      executionId,
      state: "failed",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      error: rules.reason,
      durationMs: Date.now() - t0,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "blocked", reason: rules.reason ?? "" }),
      lang,
    };
  }

  const mappedKind = mapAutomationIntentToAgentActionKind(input.intent.actionType);
  const leadPriority = computeLeadPriorityScore(ctx, input.intent);
  const hotAutoBypassGate =
    leadPriority.score >= 85 &&
    isHotAutoBypassAction(input.intent.actionType) &&
    rules.forceHumanApproval !== true;

  const gate = evaluateHumanApprovalGate({
    kind: mappedKind,
    humanApproved: input.humanApproved === true || hotAutoBypassGate,
    payload: { ...input.businessContext, sessionId: ctx.sessionId },
  });

  if (gate.required && input.humanApproved !== true) {
    push(`human_gate pendingApprovalId=${gate.pendingApprovalId}`);
    logExecutionObs({
      executionId,
      message: "human_approval_required",
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      meta: { pendingApprovalId: gate.pendingApprovalId, reason: gate.reason },
    });
    return {
      success: false,
      executionId,
      state: "detected",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      pendingApprovalId: gate.pendingApprovalId,
      error: gate.reason,
      durationMs: Date.now() - t0,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "queued_human" }),
      lang,
    };
  }

  if (!transitionAutomationExecution(record, "approved", "policy_ok")) {
    push("transition_error_to_approved");
  }

  const forceHuman = rules.forceHumanApproval === true && input.humanApproved !== true;
  const humanGateSatisfied =
    input.humanApproved === true || !input.intent.requiresApproval || hotAutoBypassGate;

  const job = await enqueueAutomationAction({
    event: route.event,
    ctx,
    intent: input.intent,
    idempotencyKey,
    forceHumanGate: forceHuman,
    humanGateSatisfied: forceHuman ? false : humanGateSatisfied,
    routedChannel: channel,
  });

  if (!job) {
    transitionAutomationExecution(record, "failed", "enqueue_blocked");
    logExecutionObs({
      executionId,
      message: "enqueue_failed_safety_or_duplicate",
      level: "warn",
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      to: "failed",
    });
    return {
      success: false,
      executionId,
      state: "failed",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      error: "enqueue_blocked",
      durationMs: Date.now() - t0,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "blocked", reason: "enqueue_blocked" }),
      lang,
    };
  }

  push(`queued jobId=${job.id} status=${job.status}`);
  transitionAutomationExecution(record, "queued", "job_created");
  logExecutionObs({
    executionId,
    message: "job_enqueued",
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    from: "approved",
    to: "queued",
    meta: { jobId: job.id, jobStatus: job.status },
  });

  if (job.status === "awaiting_human") {
    return {
      success: false,
      executionId,
      state: "queued",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      jobId: job.id,
      error: "awaiting_human_approval",
      durationMs: Date.now() - t0,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "queued_human" }),
      lang,
    };
  }

  const afterEnqueue = getAutomationJob(job.id);
  if (afterEnqueue && isAutomationDispatchSuccessStatus(afterEnqueue.status)) {
    const dur = Date.now() - t0;
    transitionAutomationExecution(record, "executed", "auto_hot_sync");
    logExecutionObs({
      executionId,
      message: "executed_ok_auto_hot",
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      from: "queued",
      to: "executed",
      durationMs: dur,
      retries: afterEnqueue.attempts > 1 ? afterEnqueue.attempts - 1 : 0,
    });
    push(`executed auto_hot jobId=${job.id}`);
    return {
      success: true,
      executionId,
      state: "executed",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      jobId: job.id,
      webhookOk: true,
      durationMs: dur,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, {
        kind: "sent_ok",
        channel,
        workflowKey: route.workflowKey,
      }),
      lang,
    };
  }

  if (afterEnqueue?.status === "failed") {
    const dur = Date.now() - t0;
    transitionAutomationExecution(record, "failed", afterEnqueue.lastError ?? "auto_hot_failed");
    logExecutionObs({
      executionId,
      message: "auto_hot_failed",
      level: "error",
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      to: "failed",
      error: afterEnqueue.lastError,
      durationMs: dur,
    });
    return {
      success: false,
      executionId,
      state: "failed",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      jobId: job.id,
      webhookOk: false,
      error: afterEnqueue.lastError ?? "auto_hot_failed",
      durationMs: dur,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "failed", error: afterEnqueue.lastError }),
      lang,
    };
  }

  let webhookOk: boolean | undefined;
  if (input.executeImmediately === true && job.status === "pending") {
    transitionAutomationExecution(record, "processing", "immediate_run");
    webhookOk = await processAutomationActionJob(job.id);
    const updated = getAutomationJob(job.id);
    const dur = Date.now() - t0;

    if (webhookOk && updated && isAutomationDispatchSuccessStatus(updated.status)) {
      transitionAutomationExecution(record, "executed", "webhook_ok");
      logExecutionObs({
        executionId,
        message: "executed_ok",
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        from: "processing",
        to: "executed",
        durationMs: dur,
        retries: updated.attempts > 1 ? updated.attempts - 1 : 0,
      });
      push("executed ok");
      return {
        success: true,
        executionId,
        state: "executed",
        channel,
        workflowUsed: route.workflowKey,
        logs,
        jobId: job.id,
        webhookOk: true,
        durationMs: dur,
        agentFeedbackHint: formatLiveExecutionFeedback(lang, {
          kind: "sent_ok",
          channel,
          workflowKey: route.workflowKey,
        }),
        lang,
      };
    }

    if (updated?.status === "pending") {
      transitionAutomationExecution(record, "retrying", "webhook_retry");
      logExecutionObs({
        executionId,
        message: "retrying",
        level: "warn",
        agentId: ctx.agentId,
        sessionId: ctx.sessionId,
        to: "retrying",
        retries: updated.attempts,
        error: updated.lastError,
      });
      return {
        success: false,
        executionId,
        state: "retrying",
        channel,
        workflowUsed: route.workflowKey,
        logs,
        jobId: job.id,
        webhookOk: false,
        error: updated.lastError,
        durationMs: dur,
        agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "failed", error: updated.lastError }),
        lang,
      };
    }

    transitionAutomationExecution(record, "failed", updated?.lastError ?? "webhook_failed");
    logExecutionObs({
      executionId,
      message: "executed_failed",
      level: "error",
      agentId: ctx.agentId,
      sessionId: ctx.sessionId,
      to: "failed",
      error: updated?.lastError,
      durationMs: dur,
    });
    return {
      success: false,
      executionId,
      state: "failed",
      channel,
      workflowUsed: route.workflowKey,
      logs,
      jobId: job.id,
      webhookOk: false,
      error: updated?.lastError ?? "webhook_failed",
      durationMs: dur,
      agentFeedbackHint: formatLiveExecutionFeedback(lang, { kind: "failed", error: updated?.lastError }),
      lang,
    };
  }

  const dur = Date.now() - t0;
  logExecutionObs({
    executionId,
    message: "queued_async",
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    durationMs: dur,
    meta: { jobId: job.id },
  });

  return {
    success: true,
    executionId,
    state: "queued",
    channel,
    workflowUsed: route.workflowKey,
    logs,
    jobId: job.id,
    durationMs: dur,
    agentFeedbackHint: formatLiveExecutionFeedback(lang, {
      kind: "queued_async",
      channel,
      workflowKey: route.workflowKey,
    }),
    lang,
  };
}
