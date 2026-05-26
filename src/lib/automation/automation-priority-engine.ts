/**
 * Scoring priorité lead (0–100) — froid / tiède / chaud.
 * Entrées : intention, engagement, signaux d’achat, urgence dans le langage.
 */

import "server-only";

import type { AutomationActionType, AutomationIntentSignal } from "./automation-intent-engine";
import { analyzeTriggerSignals } from "./triggers/trigger-signals";
import type { AutomationLang, ConversationAutomationContext } from "./types";

export type LeadPriorityBand = "cold" | "warm" | "hot";

export type LeadPriorityFactors = {
  intentDetection: number;
  engagement: number;
  purchaseSignal: number;
  languageUrgency: number;
};

export type LeadPriorityResult = {
  score: number;
  band: LeadPriorityBand;
  factors: LeadPriorityFactors;
};

export const SOFT_ACK_FALLBACK_FR =
  "Nous avons bien reçu votre demande. Un conseiller va finaliser votre commande.";

export const SOFT_ACK_FALLBACK_EN =
  "We've received your request. An advisor will finalize your order shortly.";

export const SOFT_ACK_FALLBACK_ES =
  "Hemos recibido tu solicitud. Un asesor finalizará tu pedido.";

/** Aligné produit : email produit / collecte, WhatsApp, création commande. */
const HOT_AUTO_BYPASS_ACTIONS: ReadonlySet<AutomationActionType> = new Set([
  "SEND_PRODUCT_EMAIL",
  "COLLECT_EMAIL_AND_SEND_DETAILS",
  "SEND_WHATSAPP_FOLLOWUP",
  "CREATE_ORDER_DRAFT",
]);

export function isHotAutoBypassAction(actionType: AutomationActionType | undefined): boolean {
  if (!actionType) return false;
  return HOT_AUTO_BYPASS_ACTIONS.has(actionType);
}

export function leadBandFromScore(score: number): LeadPriorityBand {
  if (score >= 85) return "hot";
  if (score >= 41) return "warm";
  return "cold";
}

/**
 * cold = 0–40 · warm = 41–84 · hot = 85–100
 */
export function computeLeadPriorityScore(
  ctx: ConversationAutomationContext,
  intent?: AutomationIntentSignal | null,
): LeadPriorityResult {
  const signals = analyzeTriggerSignals(ctx);
  const user = String(ctx.lastUserMessage ?? "");

  let intentDetection = intent?.confidence ?? 0;
  if (!intent) intentDetection = 38;
  else intentDetection = Math.max(28, intent.confidence);

  if (signals.purchaseIntent || signals.orderConfirmed) {
    intentDetection = Math.min(100, intentDetection + 12);
  }

  let engagement = 0;
  if (signals.isHot) engagement += 26;
  else if (signals.isWarm) engagement += 14;
  else if (signals.isCold) engagement += 4;

  if (signals.emailCollected) engagement += 10;
  if (ctx.prospectLead?.phone?.trim()) engagement += 8;

  const turn = ctx.conversationState?.stats?.turn_count ?? 0;
  if (turn >= 4) engagement += 6;

  const lastActive = ctx.lastProspectActiveAt ?? ctx.conversationState?.stats?.last_active_at;
  if (lastActive && Date.now() - Number(lastActive) < 12 * 60 * 1000) engagement += 12;

  let purchaseSignal = 0;
  if (signals.purchaseIntent) purchaseSignal += 32;
  if (signals.orderConfirmed) purchaseSignal += 26;
  if (signals.cartAbandoned) purchaseSignal += 14;
  if (signals.priceAsked) purchaseSignal += 8;

  let languageUrgency = 0;
  if (/\b(urgent|urgence|vite|immédiat|immédi|asap|rapid|maintenant|today|now|hoy|ya|urgente)\b/i.test(user)) {
    languageUrgency += 28;
  }
  if (/\b(aujourd'hui|demain matin|ce soir|livraison express|same\s*day)\b/i.test(user)) {
    languageUrgency += 16;
  }
  if (/\b(commande|acheter|valider|réserver|payer|checkout|order|buy)\b/i.test(user)) {
    languageUrgency += 12;
  }

  const blended =
    intentDetection * 0.32 + engagement * 0.22 + purchaseSignal * 0.28 + languageUrgency * 0.18;

  const score = Math.max(0, Math.min(100, Math.round(blended)));

  return {
    score,
    band: leadBandFromScore(score),
    factors: {
      intentDetection: Math.round(intentDetection),
      engagement: Math.round(engagement),
      purchaseSignal: Math.round(purchaseSignal),
      languageUrgency: Math.round(languageUrgency),
    },
  };
}

export function softFallbackCopy(lang?: AutomationLang): string {
  if (lang === "en") return SOFT_ACK_FALLBACK_EN;
  if (lang === "es") return SOFT_ACK_FALLBACK_ES;
  return SOFT_ACK_FALLBACK_FR;
}
