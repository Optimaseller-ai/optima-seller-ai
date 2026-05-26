/**
 * Registre central des workflows automation → n8n.
 * Source de vérité métier (id, canal, cooldown, approbation).
 */

import "server-only";

import type { AutomationEventName } from "./types";
import type { ExecutionChannel } from "./execution-types";

export type WorkflowRegistryChannel =
  | "email"
  | "whatsapp"
  | "crm"
  | "admin"
  | "voice"
  | "multi";

export type WorkflowRegistryEntry = {
  id: string;
  name: string;
  description: string;
  channel: WorkflowRegistryChannel;
  executionChannel: ExecutionChannel;
  requiresApproval: boolean;
  priority: "low" | "medium" | "high" | "critical";
  /** Cooldown minimum entre deux déclenchements (ms) pour une même session. */
  cooldownMs: number;
  enabled: boolean;
  event: AutomationEventName;
  workflowSlug: string;
  intentKey: string;
};

export const WORKFLOW_REGISTRY: Record<string, WorkflowRegistryEntry> = {
  SEND_EMAIL: {
    id: "SEND_EMAIL",
    name: "Envoi email",
    description: "Email produit, récap ou suivi commercial",
    channel: "email",
    executionChannel: "email",
    requiresApproval: true,
    priority: "medium",
    cooldownMs: 4 * 60 * 60 * 1000,
    enabled: true,
    event: "followup.required",
    workflowSlug: "followup-email-flow",
    intentKey: "SEND_PRODUCT_EMAIL",
  },
  WHATSAPP_FOLLOWUP: {
    id: "WHATSAPP_FOLLOWUP",
    name: "Relance WhatsApp",
    description: "Message conseiller sur WhatsApp",
    channel: "whatsapp",
    executionChannel: "whatsapp",
    requiresApproval: true,
    priority: "medium",
    cooldownMs: 6 * 60 * 60 * 1000,
    enabled: true,
    event: "followup.required",
    workflowSlug: "whatsapp-touch-flow",
    intentKey: "SEND_WHATSAPP_FOLLOWUP",
  },
  NEW_LEAD_NOTIFICATION: {
    id: "NEW_LEAD_NOTIFICATION",
    name: "Nouveau lead",
    description: "Notification admin — prospect créé",
    channel: "admin",
    executionChannel: "crm",
    requiresApproval: false,
    priority: "low",
    cooldownMs: 30 * 60 * 1000,
    enabled: true,
    event: "prospect.created",
    workflowSlug: "new-lead-admin-flow",
    intentKey: "SCHEDULE_REMINDER",
  },
  HOT_PROSPECT_ALERT: {
    id: "HOT_PROSPECT_ALERT",
    name: "Alerte prospect chaud",
    description: "Notification admin prioritaire",
    channel: "admin",
    executionChannel: "human",
    requiresApproval: false,
    priority: "critical",
    cooldownMs: 2 * 60 * 60 * 1000,
    enabled: true,
    event: "lead.hot",
    workflowSlug: "admin-alert-flow",
    intentKey: "HOT_PROSPECT_DETECTED",
  },
  ORDER_CONFIRMATION: {
    id: "ORDER_CONFIRMATION",
    name: "Confirmation commande",
    description: "Email / WhatsApp confirmation commande",
    channel: "multi",
    executionChannel: "email",
    requiresApproval: false,
    priority: "high",
    cooldownMs: 24 * 60 * 60 * 1000,
    enabled: true,
    event: "order.started",
    workflowSlug: "order-confirmation-flow",
    intentKey: "ORDER_CONFIRMATION",
  },
  VOICE_NOTE_FOLLOWUP: {
    id: "VOICE_NOTE_FOLLOWUP",
    name: "Relance vocale",
    description: "Workflow note vocale (future Voice AI)",
    channel: "voice",
    executionChannel: "whatsapp",
    requiresApproval: true,
    priority: "medium",
    cooldownMs: 12 * 60 * 60 * 1000,
    enabled: true,
    event: "followup.required",
    workflowSlug: "audio-followup-flow",
    intentKey: "AUDIO_FOLLOWUP",
  },
  CRM_TASK_CREATE: {
    id: "CRM_TASK_CREATE",
    name: "Tâche CRM",
    description: "Création tâche commerciale / SAV dans le CRM",
    channel: "crm",
    executionChannel: "crm",
    requiresApproval: true,
    priority: "medium",
    cooldownMs: 60 * 60 * 1000,
    enabled: true,
    event: "followup.required",
    workflowSlug: "crm-task-flow",
    intentKey: "ESCALATE_TO_HUMAN",
  },
  QUOTE_EMAIL: {
    id: "QUOTE_EMAIL",
    name: "Email devis",
    description: "Envoi ou relance devis",
    channel: "email",
    executionChannel: "email",
    requiresApproval: true,
    priority: "high",
    cooldownMs: 3 * 60 * 60 * 1000,
    enabled: true,
    event: "quote.requested",
    workflowSlug: "quote-nurture-flow",
    intentKey: "REQUEST_QUOTE_DETAILS",
  },
  ABANDONED_CONVERSATION: {
    id: "ABANDONED_CONVERSATION",
    name: "Conversation abandonnée",
    description: "Relance douce après silence prospect",
    channel: "email",
    executionChannel: "email",
    requiresApproval: false,
    priority: "low",
    cooldownMs: 24 * 60 * 60 * 1000,
    enabled: true,
    event: "prospect.silent",
    workflowSlug: "abandoned-cart-flow",
    intentKey: "ABANDONED_CART",
  },
};

export function getWorkflowRegistryEntry(id: string): WorkflowRegistryEntry | undefined {
  return WORKFLOW_REGISTRY[id.trim().toUpperCase()];
}

export function listEnabledWorkflows(): WorkflowRegistryEntry[] {
  return Object.values(WORKFLOW_REGISTRY).filter((w) => w.enabled);
}

export function resolveRegistryByIntent(intentKey: string): WorkflowRegistryEntry | undefined {
  const key = intentKey.trim();
  return Object.values(WORKFLOW_REGISTRY).find((w) => w.intentKey === key);
}
