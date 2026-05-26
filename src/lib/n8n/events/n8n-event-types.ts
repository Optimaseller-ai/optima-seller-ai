import type { AutomationEventName } from "@/lib/automation/types";

/** Types de workflows métier exécutés via n8n (stable pour mapping + supervision). */
export type N8nWorkflowKind =
  | "email_followup"
  | "whatsapp_followup"
  | "hot_prospect_alert"
  | "abandoned_cart"
  | "order_confirmation"
  | "delivery_update"
  | "payment_reminder"
  | "audio_followup"
  | "admin_alert"
  | "generic_automation";

export type N8nWorkflowRunStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "retrying"
  | "awaiting_human"
  | "partial";

export type N8nIntentKey =
  | "SEND_FOLLOWUP_EMAIL"
  | "SEND_PRODUCT_EMAIL"
  | "COLLECT_EMAIL_AND_SEND_DETAILS"
  | "SEND_WHATSAPP_FOLLOWUP"
  | "HOT_PROSPECT_DETECTED"
  | "ABANDONED_CART"
  | "ORDER_CONFIRMATION"
  | "DELIVERY_UPDATE"
  | "PAYMENT_REMINDER"
  | "AUDIO_FOLLOWUP"
  | "SCHEDULE_REMINDER"
  | "ESCALATE_TO_HUMAN"
  | "CREATE_ORDER_DRAFT"
  | "REQUEST_QUOTE_DETAILS"
  | "SEND_CATALOG_LINK";

export type N8nDispatchPayload = {
  intent: N8nIntentKey;
  workflowKind: N8nWorkflowKind;
  workflowSlug: string;
  event: AutomationEventName;
  timestamp: string;
  jobId: string;
  requiresApproval: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  prospect: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    leadTemperature?: string;
    primaryNeed?: string;
  };
  conversation: {
    sessionId: string;
    conversationId?: string;
    lastUserMessage?: string;
    pipelineStage?: string;
    lang?: string;
  };
  agent: {
    id: string;
    displayName?: string;
  };
  action: {
    type: string;
    confidence?: number;
    priority?: string;
    rationale?: string;
  };
  businessContext: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type N8nCallbackPayload = {
  jobId: string;
  runId?: string;
  status: "success" | "failure" | "partial" | "running";
  workflowKind?: N8nWorkflowKind;
  workflowSlug?: string;
  message?: string;
  error?: string;
  partialSteps?: string[];
  completedSteps?: string[];
  timestamp?: string;
  signature?: string;
  data?: Record<string, unknown>;
};
