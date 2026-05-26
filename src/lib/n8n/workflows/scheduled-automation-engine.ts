import "server-only";

import type { AutomationIntentSignal } from "@/lib/automation/automation-intent-engine";
import { enqueueAutomationAction, scheduleAutomationAction } from "@/lib/automation/action-queue";
import type { ConversationAutomationContext } from "@/lib/automation/types";

import { mapIntentToWorkflow } from "../mapping/workflow-mapping-engine";
import type { N8nWorkflowKind } from "../events/n8n-event-types";

export type ScheduledAutomationPreset =
  | "followup_tomorrow"
  | "reminder_2h"
  | "order_followup_24h"
  | "cart_recovery_48h"
  | "payment_reminder_24h"
  | "delivery_check_12h";

const PRESETS: Record<
  ScheduledAutomationPreset,
  { delayMs: number; actionType: string; workflowKind: N8nWorkflowKind; rationale: string }
> = {
  followup_tomorrow: {
    delayMs: 24 * 60 * 60 * 1000,
    actionType: "SCHEDULE_REMINDER",
    workflowKind: "email_followup",
    rationale: "Relance prévue demain",
  },
  reminder_2h: {
    delayMs: 2 * 60 * 60 * 1000,
    actionType: "SEND_WHATSAPP_FOLLOWUP",
    workflowKind: "whatsapp_followup",
    rationale: "Rappel dans 2 heures",
  },
  order_followup_24h: {
    delayMs: 24 * 60 * 60 * 1000,
    actionType: "CREATE_ORDER_DRAFT",
    workflowKind: "order_confirmation",
    rationale: "Suivi commande sous 24h",
  },
  cart_recovery_48h: {
    delayMs: 48 * 60 * 60 * 1000,
    actionType: "REQUEST_QUOTE_DETAILS",
    workflowKind: "abandoned_cart",
    rationale: "Relance panier abandonné 48h",
  },
  payment_reminder_24h: {
    delayMs: 24 * 60 * 60 * 1000,
    actionType: "SCHEDULE_REMINDER",
    workflowKind: "payment_reminder",
    rationale: "Rappel paiement 24h",
  },
  delivery_check_12h: {
    delayMs: 12 * 60 * 60 * 1000,
    actionType: "SCHEDULE_REMINDER",
    workflowKind: "delivery_update",
    rationale: "Point livraison 12h",
  },
};

function buildIntent(preset: ScheduledAutomationPreset): AutomationIntentSignal {
  const p = PRESETS[preset];
  const mapping = mapIntentToWorkflow({ actionType: p.actionType, suggestedWorkflow: `${p.workflowKind}-flow` });
  return {
    actionType: p.actionType as AutomationIntentSignal["actionType"],
    confidence: 62,
    priority: "medium",
    requiresApproval: mapping.requiresApprovalDefault,
    suggestedWorkflow: mapping.workflowSlug,
    rationale: p.rationale,
  };
}

export async function schedulePresetAutomation(args: {
  preset: ScheduledAutomationPreset;
  ctx: ConversationAutomationContext;
  scheduledAt?: string;
  idempotencyKey?: string;
}) {
  const p = PRESETS[args.preset];
  const scheduledFor = args.scheduledAt ?? new Date(Date.now() + p.delayMs).toISOString();
  const intent = buildIntent(args.preset);
  const mapping = mapIntentToWorkflow({ actionType: intent.actionType, suggestedWorkflow: intent.suggestedWorkflow });

  return scheduleAutomationAction({
    event: mapping.event,
    ctx: args.ctx,
    intent,
    scheduledFor,
    idempotencyKey: args.idempotencyKey ?? `preset_${args.preset}_${args.ctx.sessionId}`,
  });
}

export async function scheduleCustomAutomation(args: {
  ctx: ConversationAutomationContext;
  intent: AutomationIntentSignal;
  scheduledFor: string;
  idempotencyKey?: string;
}) {
  const mapping = mapIntentToWorkflow({
    actionType: args.intent.actionType,
    suggestedWorkflow: args.intent.suggestedWorkflow,
  });
  return scheduleAutomationAction({
    event: mapping.event,
    ctx: args.ctx,
    intent: args.intent,
    scheduledFor: args.scheduledFor,
    idempotencyKey: args.idempotencyKey,
  });
}

export async function enqueueImmediateN8nAction(args: {
  ctx: ConversationAutomationContext;
  intent: AutomationIntentSignal;
  idempotencyKey?: string;
  humanGateSatisfied?: boolean;
}) {
  const mapping = mapIntentToWorkflow({
    actionType: args.intent.actionType,
    suggestedWorkflow: args.intent.suggestedWorkflow,
  });
  return enqueueAutomationAction({
    event: mapping.event,
    ctx: args.ctx,
    intent: args.intent,
    idempotencyKey: args.idempotencyKey,
    humanGateSatisfied: args.humanGateSatisfied,
    forceHumanGate: args.intent.requiresApproval && args.humanGateSatisfied !== true,
  });
}

export function listScheduledPresets(): Array<{ id: ScheduledAutomationPreset; label: string; delayMs: number }> {
  return (Object.keys(PRESETS) as ScheduledAutomationPreset[]).map((id) => ({
    id,
    label: PRESETS[id].rationale,
    delayMs: PRESETS[id].delayMs,
  }));
}
