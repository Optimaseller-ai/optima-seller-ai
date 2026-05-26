/**
 * Payload n8n canonique — structure unique, sans doublons racine.
 */

import "server-only";

import { getCommercialAgentById } from "@/lib/agents/personality/commercial-agents";
import { mapJobStatusToDeliveryStatus } from "../automation-delivery-status";
import type { AutomationActionJob } from "../action-queue";
import { resolveRegistryByIntent } from "../workflow-registry";
import { scheduleAutomationDelay } from "../scheduler/automation-scheduler";
import type {
  AutomationEventName,
  AutomationTriggerKind,
  ConversationAutomationContext,
  QueuedAutomationEvent,
} from "../types";
import { mapAutomationIntentToWorkflow, mapIntentToWorkflow } from "@/lib/n8n/mapping/workflow-mapping-engine";

/** Structure stable envoyée à n8n (aucun champ dupliqué à la racine). */
export type N8nStablePayload = {
  event: AutomationEventName | string;
  timestamp: string;
  business: {
    businessName: string;
    timezone: string;
    country: string;
    currency: string;
    city?: string;
  };
  prospect: {
    prospectName: string;
    email?: string;
    phone?: string;
    country?: string;
    language: string;
    interestLevel: "low" | "medium" | "high";
    leadTemperature: string;
    intent: string;
    primaryNeed?: string;
    userId: string;
  };
  agent: {
    id: string;
    agentName: string;
    personalityType: string;
    responseStyle: string;
  };
  conversation: {
    conversationId: string;
    sessionId: string;
    summary: string;
    lastMessage: string;
    sentiment: "positive" | "neutral" | "negative" | "unknown";
    pipelineStage: string;
    language: string;
  };
  automation: {
    workflow: string;
    workflowId?: string;
    workflowKind?: string;
    trigger: string;
    channel?: string;
    priority: string;
    requiresApproval: boolean;
    automationStatus: string;
    retryCount: number;
    scheduledFor: string;
    approvalStatus: "pending" | "approved" | "rejected";
    jobId: string;
  };
  metadata: Record<string, unknown>;
};

export type BuildN8nPayloadExtras = {
  runId?: string;
  workflowSlug?: string;
  workflowKind?: string;
  softFallbackMessage?: string;
};

const DEFAULT_TIMEZONE = "Africa/Douala";
const DEFAULT_CURRENCY = String(process.env.OPTIMA_DEFAULT_CURRENCY ?? "XAF").trim() || "XAF";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

/** ID conversation stable — jamais null en sortie. */
export function resolveStableConversationId(
  ctx: ConversationAutomationContext,
  fallbackKey?: string,
): string {
  const explicit = str(ctx.conversationId);
  if (explicit) return explicit;

  const agent = str(ctx.agentId);
  const session = str(ctx.sessionId);
  if (agent && session) return `optima_conv_${agent}_${session}`;

  const user = str(ctx.userId);
  if (user && session) return `optima_conv_user_${user}_${session}`;

  return `optima_conv_${str(fallbackKey) || "unknown"}`;
}

function interestLevelFromTemp(temp?: string): "low" | "medium" | "high" {
  if (temp === "hot" || temp === "ready" || temp === "ready_to_buy") return "high";
  if (temp === "warm") return "medium";
  return "low";
}

function inferSentiment(message: string): N8nStablePayload["conversation"]["sentiment"] {
  const m = message.toLowerCase();
  if (/\b(merci|super|parfait|génial|excellent|ok pour|d'accord|yes|perfect)\b/.test(m)) return "positive";
  if (/\b(colère|furieux|arnaque|nul|honte|plainte|refuse|angry|scam)\b/.test(m)) return "negative";
  return "neutral";
}

function inferCountry(ctx: ConversationAutomationContext): string {
  const explicit = str((ctx as { businessCountry?: string }).businessCountry);
  if (explicit) return explicit;
  const prospectCity = str(ctx.prospectLead?.city);
  if (prospectCity) return prospectCity;
  const city = str(ctx.city);
  if (city) return city;
  const tz = str(ctx.businessIanaTimezone);
  if (/Douala|Yaounde|Africa\/Douala|Lagos|Africa\/Lagos/i.test(tz)) return "CM";
  if (/Abidjan|Africa\/Abidjan/i.test(tz)) return "CI";
  if (/Paris|Europe\/Paris/i.test(tz)) return "FR";
  return "—";
}

function resolveTrigger(job: AutomationActionJob, registryIntentKey?: string): string {
  const fromCtx = str(
    (job.ctx as { automationTrigger?: AutomationTriggerKind }).automationTrigger,
  );
  return str(registryIntentKey) || str(job.intent?.actionType) || fromCtx || job.event;
}

function needsDeferredSchedule(event: string, intentType?: string): boolean {
  if (event === "followup.required" || event === "prospect.silent") return true;
  if (
    intentType === "SEND_WHATSAPP_FOLLOWUP" ||
    intentType === "SEND_PRODUCT_EMAIL" ||
    intentType === "COLLECT_EMAIL_AND_SEND_DETAILS" ||
    intentType === "SCHEDULE_REMINDER"
  ) {
    return true;
  }
  return false;
}

/** scheduledFor ISO — jamais null pour relances / emails différés. */
export function resolveScheduledForIso(job: AutomationActionJob, event: string): string {
  if (job.scheduledFor && Number.isFinite(Date.parse(job.scheduledFor))) {
    return job.scheduledFor;
  }

  const payloadScheduled = str(
    (job as { queuePayload?: Record<string, unknown> }).queuePayload?.scheduledFor,
  );
  if (payloadScheduled && Number.isFinite(Date.parse(payloadScheduled))) {
    return payloadScheduled;
  }

  const intentType = job.intent?.actionType;
  if (needsDeferredSchedule(event, intentType) || job.status === "scheduled") {
    const temp = job.ctx.leadTemperature ?? job.ctx.prospectLead?.leadTemperature;
    const schedule = scheduleAutomationDelay({
      ctx: job.ctx,
      leadTemperature: temp,
      interestLevel: interestLevelFromTemp(temp),
    });
    return schedule.scheduledFor;
  }

  return new Date().toISOString();
}

function buildConversationSummary(
  ctx: ConversationAutomationContext,
  job: AutomationActionJob,
  temp: string,
  pipeline: string,
): string {
  const name = str(ctx.prospectLead?.name) || "Prospect";
  const need = str(ctx.prospectLead?.primaryNeed);
  const rationale = str(job.intent?.rationale);

  if (rationale.length >= 12) return rationale.slice(0, 400);

  if (temp === "hot" || temp === "ready" || temp === "ready_to_buy") {
    return `${name} — prospect chaud, prêt à avancer (${pipeline}).`;
  }
  if (temp === "warm") {
    return `${name} — intérêt confirmé, suivi commercial recommandé.`;
  }
  if (pipeline === "negotiating" || pipeline === "ready_to_buy") {
    return `${name} — négociation ou achat en cours.`;
  }
  if (need) {
    return `${name} — besoin exprimé : ${need.slice(0, 120)}.`;
  }
  const last = str(ctx.lastUserMessage).slice(0, 160);
  return last ? `${name} — dernier message : « ${last} »` : `${name} — conversation en cours.`;
}

function agentEnrichment(ctx: ConversationAutomationContext) {
  const commercial = getCommercialAgentById(ctx.agentId);
  return {
    agentName: str(ctx.agentName) || commercial?.name || "Conseiller",
    personalityType:
      str((ctx as { agentPersonalityType?: string }).agentPersonalityType) ||
      commercial?.personality ||
      "professionnel",
    responseStyle:
      str((ctx as { agentResponseStyle?: string }).agentResponseStyle) ||
      commercial?.salesStyle ||
      commercial?.tone ||
      "conseiller",
  };
}

function workflowMappingForJob(job: AutomationActionJob) {
  if (job.intent) return mapAutomationIntentToWorkflow(job.intent);
  return mapIntentToWorkflow({
    actionType: job.event,
    leadTemperature: job.ctx.leadTemperature ?? job.ctx.prospectLead?.leadTemperature,
  });
}

/**
 * Construit le payload canonique depuis une job automation.
 */
export function buildNormalizedN8nPayload(
  job: AutomationActionJob,
  extras?: BuildN8nPayloadExtras,
): N8nStablePayload {
  const mapping = workflowMappingForJob(job);
  const registry = resolveRegistryByIntent(job.intent?.actionType ?? mapping.intent);
  const event = (registry?.event ?? mapping.event ?? job.event) as AutomationEventName;
  const workflowSlug = extras?.workflowSlug ?? registry?.workflowSlug ?? mapping.workflowSlug;
  const workflowKind = extras?.workflowKind ?? mapping.workflowKind;

  const temp =
    str(job.ctx.leadTemperature) ||
    str(job.ctx.prospectLead?.leadTemperature) ||
    "cold";
  const pipeline = str(job.ctx.pipelineStage) || "interested";
  const lastMsg = str(job.ctx.lastUserMessage).slice(0, 800);
  const agent = agentEnrichment(job.ctx);
  const conversationId = resolveStableConversationId(job.ctx, job.id);
  const scheduledFor = resolveScheduledForIso(job, event);
  const automationStatus = mapJobStatusToDeliveryStatus(job.status);

  const approvalStatus: N8nStablePayload["automation"]["approvalStatus"] =
    job.status === "awaiting_human" || (job.requiresHumanApproval && job.status !== "completed")
      ? "pending"
      : "approved";

  const prospectName = str(job.ctx.prospectLead?.name) || "Prospect";
  const lang =
    job.ctx.lang ??
    job.ctx.prospectLead?.language ??
    "fr";

  return {
    event,
    timestamp: new Date().toISOString(),
    business: {
      businessName: str(job.ctx.businessName) || "Boutique",
      timezone: str(job.ctx.businessIanaTimezone) || DEFAULT_TIMEZONE,
      country: inferCountry(job.ctx),
      currency: str((job.ctx as { businessCurrency?: string }).businessCurrency) || DEFAULT_CURRENCY,
      city: str(job.ctx.city) || str(job.ctx.prospectLead?.city) || undefined,
    },
    prospect: {
      prospectName,
      email: str(job.ctx.prospectLead?.email) || undefined,
      phone: str(job.ctx.prospectLead?.phone) || undefined,
      country: str(job.ctx.prospectLead?.city) || inferCountry(job.ctx),
      language: lang,
      interestLevel: interestLevelFromTemp(temp),
      leadTemperature: temp,
      intent: str(job.intent?.actionType ?? mapping.intent),
      primaryNeed: str(job.ctx.prospectLead?.primaryNeed) || undefined,
      userId: str(job.ctx.userId),
    },
    agent: {
      id: str(job.ctx.agentId),
      agentName: agent.agentName,
      personalityType: agent.personalityType,
      responseStyle: agent.responseStyle,
    },
    conversation: {
      conversationId,
      sessionId: str(job.ctx.sessionId),
      summary: buildConversationSummary(job.ctx, job, temp, pipeline),
      lastMessage: lastMsg,
      sentiment: inferSentiment(lastMsg),
      pipelineStage: pipeline,
      language: lang,
    },
    automation: {
      workflow: workflowSlug,
      workflowId: registry?.id,
      workflowKind,
      trigger: resolveTrigger(job, registry?.intentKey ?? mapping.intent),
      channel: job.routedChannel ?? registry?.channel,
      priority: str(job.intent?.priority ?? registry?.priority ?? "medium"),
      requiresApproval: job.requiresHumanApproval ?? registry?.requiresApproval ?? false,
      automationStatus,
      retryCount: job.attempts,
      scheduledFor,
      approvalStatus,
      jobId: job.id,
    },
    metadata: {
      payloadVersion: 2,
      priorityScore: job.priorityScore,
      priorityBand: job.priorityBand,
      executionPath: job.executionPath ?? "standard",
      idempotencyKey: job.idempotencyKey,
      runId: extras?.runId,
      routedChannel: job.routedChannel,
      intentConfidence: job.intent?.confidence,
      intentRationale: job.intent?.rationale?.slice(0, 200),
      softFallbackMessage: extras?.softFallbackMessage,
      logTrailTail: job.logTrail.slice(-8),
    },
  };
}

/** @deprecated Alias — utiliser buildNormalizedN8nPayload */
export function buildN8nProductionPayload(
  job: AutomationActionJob,
  extras?: BuildN8nPayloadExtras,
): N8nStablePayload {
  return buildNormalizedN8nPayload(job, extras);
}

export function buildHotProspectPayload(
  job: AutomationActionJob,
  extras?: BuildN8nPayloadExtras,
): N8nStablePayload {
  const base = buildNormalizedN8nPayload(job, {
    ...extras,
    workflowSlug: "admin-alert-flow",
    workflowKind: "hot_prospect_alert",
  });
  return {
    ...base,
    event: "lead.hot",
    automation: {
      ...base.automation,
      workflow: "admin-alert-flow",
      workflowId: "HOT_PROSPECT_ALERT",
      priority: "critical",
    },
    conversation: {
      ...base.conversation,
      summary: base.conversation.summary.includes("chaud")
        ? base.conversation.summary
        : `${base.prospect.prospectName} — prospect chaud, prêt à acheter immédiatement.`,
    },
  };
}

/** Reconstruit le contexte conversation depuis la file (cron / flush différé). */
export function conversationContextFromQueuePayload(
  row: QueuedAutomationEvent,
  partial?: ConversationAutomationContext,
): ConversationAutomationContext {
  const p = row.payload ?? {};
  return {
    agentId: str(partial?.agentId) || str(p.agentId) || "unknown_agent",
    sessionId: str(partial?.sessionId) || str(p.sessionId) || row.id,
    conversationId:
      partial?.conversationId ??
      (p.conversationId as string | null | undefined) ??
      null,
    userId: str(partial?.userId) || str(p.userId) || "unknown_user",
    lastUserMessage:
      str(partial?.lastUserMessage) || str(p.lastUserMessage).slice(0, 800),
    lastAssistantReply: partial?.lastAssistantReply,
    conversationState: partial?.conversationState,
    prospectLead: partial?.prospectLead,
    leadTemperature:
      partial?.leadTemperature ??
      (p.leadTemperature as ConversationAutomationContext["leadTemperature"]),
    pipelineStage:
      partial?.pipelineStage ??
      (p.pipelineStage as ConversationAutomationContext["pipelineStage"]),
    businessIanaTimezone: partial?.businessIanaTimezone,
    city: partial?.city,
    businessName: partial?.businessName,
    agentName: partial?.agentName,
    lang: partial?.lang,
    lastProspectActiveAt: partial?.lastProspectActiveAt,
    relanceCount: partial?.relanceCount,
  };
}

/** Payload depuis la file événements (après message prospect). */
export function buildNormalizedN8nPayloadFromQueuedEvent(
  row: QueuedAutomationEvent,
  ctx: ConversationAutomationContext,
): N8nStablePayload {
  const p = row.payload ?? {};
  const mergedCtx = conversationContextFromQueuePayload(row, ctx);
  const pseudoJob: AutomationActionJob = {
    id: str(p.jobId) || row.id,
    createdAt: row.createdAt,
    status: "pending",
    event: row.event,
    attempts: row.attempts,
    maxAttempts: 3,
    requiresHumanApproval: false,
    ctx: mergedCtx,
    logTrail: [],
    scheduledFor: str(p.scheduledFor) || undefined,
  };

  (pseudoJob as { queuePayload?: Record<string, unknown> }).queuePayload = p;

  const triggerKind =
    row.trigger ?? (p.triggerKind as AutomationTriggerKind | undefined);
  if (triggerKind) {
    (pseudoJob.ctx as { automationTrigger?: AutomationTriggerKind }).automationTrigger =
      triggerKind;
  }

  return buildNormalizedN8nPayload(pseudoJob, {
    workflowSlug: str(p.workflowSlug) || undefined,
  });
}

export type { N8nStablePayload as N8nProductionPayload };
