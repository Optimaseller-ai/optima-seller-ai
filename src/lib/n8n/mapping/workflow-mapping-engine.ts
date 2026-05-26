import "server-only";

import type { AutomationIntentSignal } from "@/lib/automation/automation-intent-engine";
import type { AutomationEventName } from "@/lib/automation/types";
import type { N8nIntentKey, N8nWorkflowKind } from "../events/n8n-event-types";

export type WorkflowMapping = {
  intent: N8nIntentKey;
  workflowKind: N8nWorkflowKind;
  workflowSlug: string;
  event: AutomationEventName;
  requiresApprovalDefault: boolean;
};

const MAPPINGS: Record<string, WorkflowMapping> = {
  SEND_PRODUCT_EMAIL: {
    intent: "SEND_PRODUCT_EMAIL",
    workflowKind: "email_followup",
    workflowSlug: "followup-email-flow",
    event: "followup.required",
    requiresApprovalDefault: true,
  },
  COLLECT_EMAIL_AND_SEND_DETAILS: {
    intent: "COLLECT_EMAIL_AND_SEND_DETAILS",
    workflowKind: "email_followup",
    workflowSlug: "followup-email-flow",
    event: "email.collected",
    requiresApprovalDefault: true,
  },
  SEND_WHATSAPP_FOLLOWUP: {
    intent: "SEND_WHATSAPP_FOLLOWUP",
    workflowKind: "whatsapp_followup",
    workflowSlug: "whatsapp-touch-flow",
    event: "followup.required",
    requiresApprovalDefault: true,
  },
  SCHEDULE_REMINDER: {
    intent: "SCHEDULE_REMINDER",
    workflowKind: "email_followup",
    workflowSlug: "smart-reengagement-flow",
    event: "followup.required",
    requiresApprovalDefault: false,
  },
  ESCALATE_TO_HUMAN: {
    intent: "ESCALATE_TO_HUMAN",
    workflowKind: "hot_prospect_alert",
    workflowSlug: "admin-alert-flow",
    event: "complaint.raised",
    requiresApprovalDefault: true,
  },
  CREATE_ORDER_DRAFT: {
    intent: "CREATE_ORDER_DRAFT",
    workflowKind: "order_confirmation",
    workflowSlug: "order-confirmation-flow",
    event: "purchase.intent",
    requiresApprovalDefault: true,
  },
  REQUEST_QUOTE_DETAILS: {
    intent: "REQUEST_QUOTE_DETAILS",
    workflowKind: "abandoned_cart",
    workflowSlug: "quote-nurture-flow",
    event: "quote.requested",
    requiresApprovalDefault: false,
  },
  SEND_CATALOG_LINK: {
    intent: "SEND_CATALOG_LINK",
    workflowKind: "email_followup",
    workflowSlug: "catalog-touch-flow",
    event: "purchase.intent",
    requiresApprovalDefault: false,
  },
  HOT_PROSPECT_DETECTED: {
    intent: "HOT_PROSPECT_DETECTED",
    workflowKind: "hot_prospect_alert",
    workflowSlug: "admin-alert-flow",
    event: "lead.hot",
    requiresApprovalDefault: false,
  },
  ABANDONED_CART: {
    intent: "ABANDONED_CART",
    workflowKind: "abandoned_cart",
    workflowSlug: "abandoned-cart-flow",
    event: "cart.abandoned",
    requiresApprovalDefault: false,
  },
  ORDER_CONFIRMATION: {
    intent: "ORDER_CONFIRMATION",
    workflowKind: "order_confirmation",
    workflowSlug: "order-confirmation-flow",
    event: "order.started",
    requiresApprovalDefault: false,
  },
  DELIVERY_UPDATE: {
    intent: "DELIVERY_UPDATE",
    workflowKind: "delivery_update",
    workflowSlug: "delivery-update-flow",
    event: "order.started",
    requiresApprovalDefault: false,
  },
  PAYMENT_REMINDER: {
    intent: "PAYMENT_REMINDER",
    workflowKind: "payment_reminder",
    workflowSlug: "payment-reminder-flow",
    event: "payment.pending",
    requiresApprovalDefault: true,
  },
  AUDIO_FOLLOWUP: {
    intent: "AUDIO_FOLLOWUP",
    workflowKind: "audio_followup",
    workflowSlug: "audio-followup-flow",
    event: "followup.required",
    requiresApprovalDefault: true,
  },
};

export function mapIntentToWorkflow(args: {
  actionType: string;
  suggestedWorkflow?: string;
  leadTemperature?: string;
}): WorkflowMapping {
  const key = args.actionType.trim();
  const base = MAPPINGS[key];

  if (args.leadTemperature === "hot" && !base) {
    return MAPPINGS.HOT_PROSPECT_DETECTED!;
  }

  if (base) {
    if (args.suggestedWorkflow?.trim()) {
      return { ...base, workflowSlug: args.suggestedWorkflow.trim() };
    }
    return base;
  }

  return {
    intent: "SCHEDULE_REMINDER",
    workflowKind: "generic_automation",
    workflowSlug: args.suggestedWorkflow?.trim() || "generic-automation-flow",
    event: "followup.required",
    requiresApprovalDefault: false,
  };
}

export function mapAutomationIntentToWorkflow(intent: AutomationIntentSignal): WorkflowMapping {
  return mapIntentToWorkflow({
    actionType: intent.actionType,
    suggestedWorkflow: intent.suggestedWorkflow,
  });
}

export function registerWorkflowMapping(key: string, mapping: WorkflowMapping) {
  MAPPINGS[key] = mapping;
}

export function listWorkflowMappings(): WorkflowMapping[] {
  return Object.values(MAPPINGS);
}
