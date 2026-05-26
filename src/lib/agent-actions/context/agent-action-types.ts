/**
 * Types Agent Actions — couche orchestration (WhatsApp, email, n8n, relances).
 * Distinct des `AutoActionKind` registre catalogue (workflows/auto-actions).
 */

import type { AutomationEventName } from "@/lib/automation/types";

export type AgentActionKind =
  | "send_email"
  | "send_whatsapp_followup"
  | "schedule_reminder"
  | "create_quote"
  | "notify_human"
  | "send_catalog"
  | "request_payment"
  | "create_order"
  | "book_delivery"
  /** Émission pure vers n8n / bus événements */
  | "emit_workflow_event";

export type AgentActionRequest = {
  kind: AgentActionKind;
  agentId: string;
  sessionId: string;
  userId: string;
  personaKey?: string | null;
  agentName?: string;
  conversationId?: string | null;
  businessIanaTimezone?: string;
  payload?: Record<string, unknown>;
  /** Clé idempotence métier (session + action + digest). */
  idempotencyKey?: string;
  /** Après validation admin ou règle métier explicite */
  humanApproved?: boolean;
};

export type AgentActionResult = {
  ok: boolean;
  error?: string;
  correlationId?: string;
  /** Relance / paiement en attente validation humaine */
  pendingApprovalId?: string;
  /** Pour observabilité */
  channel?: "n8n" | "internal" | "deferred";
};

/** Alias explicite pour payloads n8n — aligné sur `AutomationEventName`. */
export type AgentN8nEventName = AutomationEventName;
