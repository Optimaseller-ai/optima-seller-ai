import "server-only";

import type { AutomationActionJob } from "./action-queue";
import type { AutomationIntentSignal } from "./automation-intent-engine";
import type {
  AutomationJobDetailDTO,
  AutomationPendingItemDTO,
  AutomationSupervisionActionKindUi,
} from "./supervision-dto-types";

const PREVIEW_LEN = 480;

export function supervisionActionKindUi(job: AutomationActionJob): AutomationSupervisionActionKindUi {
  const t = job.intent?.actionType;
  const ch = job.routedChannel;

  if (ch === "email" || t === "SEND_PRODUCT_EMAIL" || t === "COLLECT_EMAIL_AND_SEND_DETAILS") return "email";
  if (ch === "whatsapp" || t === "SEND_WHATSAPP_FOLLOWUP") return "whatsapp";
  return "n8n_workflow";
}

function prospectBrief(job: AutomationActionJob): AutomationPendingItemDTO["prospect"] {
  const p = job.ctx.prospectLead;
  return {
    name: p?.name ?? null,
    email: p?.email ?? null,
    phone: p?.phone ?? null,
    primaryNeed: p?.primaryNeed ?? null,
    leadTemperature: p?.leadTemperature ?? null,
    city: p?.city ?? job.ctx.city ?? null,
  };
}

export function summarizeIntent(intent?: AutomationIntentSignal) {
  if (!intent) return {};
  return {
    intentActionType: intent.actionType,
    suggestedWorkflow: intent.suggestedWorkflow,
    intentPriority: intent.priority,
    intentConfidence: intent.confidence,
    intentRationale: intent.rationale,
    intentRequiresApproval: intent.requiresApproval,
  };
}

export function serializeAutomationPendingItem(job: AutomationActionJob): AutomationPendingItemDTO {
  const lm = job.ctx.lastUserMessage ?? "";
  return {
    id: job.id,
    createdAt: job.createdAt,
    event: job.event,
    actionKindUi: supervisionActionKindUi(job),
    routedChannel: job.routedChannel,
    prospect: prospectBrief(job),
    previewMessage: lm.length > PREVIEW_LEN ? `${lm.slice(0, PREVIEW_LEN)}…` : lm,
    agentId: job.ctx.agentId,
    sessionId: job.ctx.sessionId,
    priorityScore: job.priorityScore,
    priorityBand: job.priorityBand,
    scheduledFor: job.scheduledFor,
    nextRetryAt: job.nextRetryAt,
    ...summarizeIntent(job.intent),
  };
}

export function serializeAutomationJobDetail(job: AutomationActionJob): AutomationJobDetailDTO {
  const brief = serializeAutomationPendingItem(job);
  return {
    ...brief,
    lifecycleStatus: job.status,
    previewMessage: brief.previewMessage,
    userId: job.ctx.userId,
    conversationId: job.ctx.conversationId ?? undefined,
    lastUserMessage: job.ctx.lastUserMessage ?? "",
    lastAssistantReply: job.ctx.lastAssistantReply,
    pipelineStage: job.ctx.pipelineStage,
    lang: job.ctx.lang,
    businessName: job.ctx.businessName,
    businessCity: job.ctx.city,
    logTrail: [...job.logTrail],
  };
}
