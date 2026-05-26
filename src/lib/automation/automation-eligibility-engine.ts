import "server-only";

import { resolveSocialOnlyMode, type SocialOnlyModeSnapshot } from "@/lib/chat/pipeline/social-only-mode";
import type { ConversationAutomationContext } from "./types";

export type AutomationEligibilityResult = {
  eligible: boolean;
  blockReason: string;
  commercialSignals: string[];
  socialOnly: SocialOnlyModeSnapshot;
};

const PURCHASE = /\b(je\s+prends|je\s+commande|je\s+valide|acheter|commander|i\s+want\s+to\s+buy|quiero\s+comprar|passer\s+commande)\b/i;
const PRICING = /\b(prix|combien|tarif|devis|quote|budget|fcfa|cfa|€|how\s+much|precio|coût|cout)\b/i;
const DELIVERY = /\b(livraison|livrer|delivery|shipping|délai|delai|expédition|expedition)\b/i;
const QUOTATION = /\b(devis|quotation|proforma|facture\s+pro)\b/i;
const ORDER = /\b(commande|order|checkout|paiement|payer|pay)\b/i;
const CONTACT = /\b(email|mail|téléphone|telephone|whatsapp|appeler|call\s+me|contact)\b/i;
const EMAIL_CONFIRM = /\b(confirm.*mail|envoy.*mail|@|\.com\b)/i;
const STRONG_COMMERCIAL = /\b(urgent|aujourd'hui|today|maintenant|now|je\s+veux|besoin\s+d['’']?un|need\s+this)\b/i;

function detectCommercialSignals(message: string): string[] {
  const m = String(message ?? "");
  const out: string[] = [];
  if (PURCHASE.test(m)) out.push("purchase_intent");
  if (PRICING.test(m)) out.push("pricing_request");
  if (DELIVERY.test(m)) out.push("delivery_request");
  if (QUOTATION.test(m)) out.push("quotation_request");
  if (ORDER.test(m)) out.push("order_intent");
  if (CONTACT.test(m)) out.push("contact_request");
  if (EMAIL_CONFIRM.test(m)) out.push("email_confirmation");
  if (STRONG_COMMERCIAL.test(m)) out.push("strong_commercial_signal");
  return out;
}

/**
 * Automation autorisée uniquement sur signaux business explicites — jamais sur social pur.
 */
export function evaluateAutomationEligibility(ctx: ConversationAutomationContext): AutomationEligibilityResult {
  const socialOnly = resolveSocialOnlyMode({
    message: ctx.lastUserMessage,
    conversationState: ctx.conversationState,
    agentName: ctx.agentName,
  });

  if (socialOnly.active) {
    return {
      eligible: false,
      blockReason: `social_only_mode:${socialOnly.reason}`,
      commercialSignals: [],
      socialOnly,
    };
  }

  const commercialSignals = detectCommercialSignals(ctx.lastUserMessage);
  if (commercialSignals.length === 0) {
    return {
      eligible: false,
      blockReason: "no_commercial_signal",
      commercialSignals: [],
      socialOnly,
    };
  }

  return {
    eligible: true,
    blockReason: "",
    commercialSignals,
    socialOnly,
  };
}
