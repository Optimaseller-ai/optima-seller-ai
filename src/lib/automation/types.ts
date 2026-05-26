/**
 * Types partagés — couche automation OPTIMA Seller AI.
 */

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import type { SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { LeadTemperature } from "@/lib/prospect/lead-profile/prospect-profile";

export type AutomationLang = "fr" | "en" | "es";

/** Événements normalisés (n8n, webhooks, logs). */
export type AutomationEventName =
  | "lead.created"
  /** Alias SaaS — création fiche prospect */
  | "prospect.created"
  /** Chaque tour entrant (contrôlé par idempotence côté enqueue). */
  | "message.received"
  /** Intérêt produit / prix sans intention d’achat immédiate. */
  | "interest.detected"
  | "lead.hot"
  | "lead.warm"
  | "customer.returning"
  | "cart.abandoned"
  | "email.collected"
  | "followup.required"
  | "purchase.intent"
  | "customer.angry"
  | "quote.requested"
  | "prospect.silent"
  | "order.confirmed"
  /** Tunnel commande démarré (avant paiement confirmé). */
  | "order.started"
  | "complaint.raised"
  | "payment.pending"
  | "delivery.requested";

/** Bus événements métier (subset documenté produit — aligné sur AutomationEventName). */
export type BusinessEventName =
  | "prospect.created"
  | "message.received"
  | "interest.detected"
  | "purchase.intent"
  | "prospect.silent"
  | "email.collected"
  | "order.started";

/** Triggers métier dérivés des événements conversationnels. */
export type AutomationTriggerKind =
  | "quotation_followup"
  | "soft_relaunch"
  | "closing_sequence"
  | "gentle_nurture"
  | "no_commercial_push"
  | "order_confirmation"
  | "delivery_update"
  | "sav_ticket"
  | "human_handoff"
  | "message_received"
  | "interest_signal"
  | "checkout_started";

export type SalesPipelineStage =
  | "social"
  | "new_lead"
  | "interested"
  | "warm"
  | "hot"
  | "negotiating"
  | "ready_to_buy"
  | "customer"
  | "lost";

export type FollowupChannel = "chat" | "whatsapp" | "email";

export type ConversationAutomationContext = {
  agentId: string;
  sessionId: string;
  conversationId?: string | null;
  userId: string;
  lastUserMessage: string;
  lastAssistantReply?: string;
  conversationState?: SellerBehaviorConversationState;
  prospectLead?: SmartProspectProfile;
  leadTemperature?: LeadTemperature;
  pipelineStage?: SalesPipelineStage;
  businessIanaTimezone?: string;
  city?: string;
  businessName?: string;
  agentName?: string;
  lang?: AutomationLang;
  /** Dernière activité prospect (ms). */
  lastProspectActiveAt?: number;
  /** Relances déjà envoyées sur ce fil. */
  relanceCount?: number;
};

export type AutomationTrigger = {
  kind: AutomationTriggerKind;
  event: AutomationEventName;
  priority: number;
  reason: string;
  scheduledFor?: string;
  channel?: FollowupChannel;
  metadata?: Record<string, unknown>;
};

export type QueuedAutomationEvent = {
  id: string;
  idempotencyKey: string;
  event: AutomationEventName;
  trigger?: AutomationTriggerKind;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  status: "pending" | "processing" | "sent" | "failed" | "skipped";
};

export type SmartFollowupDecision = {
  shouldFollowUp: boolean;
  channel: FollowupChannel;
  trigger: AutomationTriggerKind | null;
  scheduledFor: string | null;
  stopReason?: string;
  messageHint?: string;
};

export type AutoActionKind =
  | "send_pdf"
  | "send_quote"
  | "send_invoice"
  | "send_catalog"
  | "trigger_human_call"
  | "create_sav_ticket"
  | "create_order";
