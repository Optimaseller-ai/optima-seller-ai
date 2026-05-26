/**
 * Analyse conversationnelle → intentions d’actions business automatiques.
 */

import type { ConversationAutomationContext } from "./types";
import { analyzeTriggerSignals } from "./triggers/trigger-signals";

export type AutomationIntentPriorityBand = "low" | "medium" | "high";

/** Types d’actions métier (upper snake — stable pour n8n / CRM). */
export type AutomationActionType =
  | "SEND_PRODUCT_EMAIL"
  | "SEND_WHATSAPP_FOLLOWUP"
  | "REQUEST_QUOTE_DETAILS"
  | "SCHEDULE_REMINDER"
  | "ESCALATE_TO_HUMAN"
  | "CREATE_ORDER_DRAFT"
  | "SEND_CATALOG_LINK"
  | "COLLECT_EMAIL_AND_SEND_DETAILS";

export type AutomationIntentSignal = {
  actionType: AutomationActionType;
  confidence: number;
  priority: AutomationIntentPriorityBand;
  requiresApproval: boolean;
  suggestedWorkflow: string;
  rationale?: string;
};

function bandFromScore(score: number): AutomationIntentPriorityBand {
  if (score >= 72) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function clampConf(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Déduit les actions possibles depuis le dernier message et le contexte.
 * Heuristique légère — complétable par modèle de classification plus tard.
 */
export function analyzeAutomationIntents(ctx: ConversationAutomationContext): AutomationIntentSignal[] {
  const signals = analyzeTriggerSignals(ctx);
  const user = String(ctx.lastUserMessage ?? "");
  const assistant = String(ctx.lastAssistantReply ?? "");

  const wantsEmailDetails =
    /\b(envoyer|envoyez|vous\s+envoie|vous\s+transmet|par\s+mail|par\s+courriel|email|e-mail)\b/i.test(
      assistant,
    ) && /\b(détail|fiche|catalogue|pdf|offre|liste)\b/i.test(assistant);

  const userGaveEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(user);

  const asksCatalog =
    /\b(catalogue|brochure|liste\s+des\s+produits|plaquette|pdf)\b/i.test(user) ||
    /\b(catalog|brochure)\b/i.test(user);
  const asksHuman = /\b(vrai\s+conseiller|humain|appeler|téléphone|whatsapp\s+direct)\b/i.test(user);

  const out: AutomationIntentSignal[] = [];

  if (wantsEmailDetails || asksCatalog) {
    const base = wantsEmailDetails ? 82 : 58;
    const boost = userGaveEmail && signals.emailCollected ? 12 : 0;
    out.push({
      actionType: userGaveEmail ? "SEND_PRODUCT_EMAIL" : "COLLECT_EMAIL_AND_SEND_DETAILS",
      confidence: clampConf(base + boost),
      priority: bandFromScore(base + boost),
      requiresApproval: true,
      suggestedWorkflow: "product_followup_sequence",
      rationale: wantsEmailDetails ? "assistant_promised_email_details" : "catalog_request",
    });
  }

  if (signals.priceAsked || signals.cartAbandoned) {
    const score = signals.cartAbandoned ? 78 : 71;
    out.push({
      actionType: "REQUEST_QUOTE_DETAILS",
      confidence: clampConf(score),
      priority: bandFromScore(score),
      requiresApproval: false,
      suggestedWorkflow: "quote_nurture_sequence",
      rationale: signals.cartAbandoned ? "abandoned_cart" : "price_question",
    });
  }

  if (signals.purchaseIntent || signals.orderConfirmed) {
    const score = signals.orderConfirmed ? 93 : 88;
    out.push({
      actionType: "CREATE_ORDER_DRAFT",
      confidence: clampConf(score),
      priority: "high",
      requiresApproval: true,
      suggestedWorkflow: "order_validation_flow",
      rationale: signals.orderConfirmed ? "order_confirmed_language" : "purchase_intent_verbatim",
    });
  }

  if (ctx.prospectLead?.phone || /\bwhatsapp\b/i.test(user)) {
    const score = signals.isHot ? 76 : 54;
    out.push({
      actionType: "SEND_WHATSAPP_FOLLOWUP",
      confidence: clampConf(score),
      priority: bandFromScore(score),
      requiresApproval: false,
      suggestedWorkflow: "whatsapp_human_touch",
      rationale: "channel_fit_whatsapp",
    });
  }

  if (signals.prospectSilent && !signals.prospectAngry) {
    out.push({
      actionType: "SCHEDULE_REMINDER",
      confidence: 62,
      priority: "medium",
      requiresApproval: false,
      suggestedWorkflow: "silent_prospect_reengage",
      rationale: "long_idle_window",
    });
  }

  if (asksHuman || signals.complaint) {
    out.push({
      actionType: "ESCALATE_TO_HUMAN",
      confidence: asksHuman ? 86 : 74,
      priority: "high",
      requiresApproval: false,
      suggestedWorkflow: "human_handoff_ticket",
      rationale: signals.complaint ? "complaint_signal" : "explicit_human_request",
    });
  }

  if (asksCatalog && !wantsEmailDetails) {
    out.push({
      actionType: "SEND_CATALOG_LINK",
      confidence: 63,
      priority: "medium",
      requiresApproval: false,
      suggestedWorkflow: "catalog_drop_light",
      rationale: "catalog_mention",
    });
  }

  const dedup = new Map<AutomationActionType, AutomationIntentSignal>();
  for (const row of out.sort((a, b) => b.confidence - a.confidence)) {
    const prev = dedup.get(row.actionType);
    if (!prev || prev.confidence < row.confidence) dedup.set(row.actionType, row);
  }

  return [...dedup.values()].sort((a, b) => b.confidence - a.confidence);
}

export function topAutomationIntent(ctx: ConversationAutomationContext): AutomationIntentSignal | null {
  const all = analyzeAutomationIntents(ctx);
  return all[0] ?? null;
}
