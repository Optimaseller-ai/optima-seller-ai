/**
 * Détection d’opportunités — uniquement à partir du prospect-core (pas de chat brut).
 */

import type { ProspectCoreProfile } from "@/lib/crm/prospect-core/prospect-profile";

export type SalesOpportunityType =
  | "none"
  | "price_request"
  | "availability_request"
  | "hesitation"
  | "comparison_mode"
  | "short_silence_window"
  | "returning_customer"
  | "buy_intent"
  | "cold_lead_reactivation";

export type SalesOpportunitySignal = {
  opportunityType: SalesOpportunityType;
  /** 0–100 — force du signal agrégé. */
  strength: number;
  recommendedAction: string;
};

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Analyse le profil CRM (intentions, tags, signaux comportementaux, score).
 */
export function detectSalesOpportunity(prospect: ProspectCoreProfile): SalesOpportunitySignal {
  const intent = String(prospect.lastIntentSummary ?? "");
  const tags = new Set(prospect.tags);
  const b = prospect.behaviorSignals;

  if (tags.has("repeat-customer") || tags.has("loyal")) {
    return {
      opportunityType: "returning_customer",
      strength: clamp(55 + prospect.salesScore * 0.25),
      recommendedAction: "ack_return_premium_soft_offer",
    };
  }

  if (intent === "purchase_intent" || prospect.salesScore >= 72) {
    return {
      opportunityType: "buy_intent",
      strength: clamp(70 + prospect.confidenceScore * 0.2),
      recommendedAction: "move_to_closing_path",
    };
  }

  if (intent === "price_inquiry" || tags.has("price-sensitive")) {
    return {
      opportunityType: "price_request",
      strength: clamp(50 + (b.priceSensitive ? 15 : 0)),
      recommendedAction: "anchor_value_then_alternatives",
    };
  }

  if (intent === "availability" || intent === "delivery_inquiry") {
    return {
      opportunityType: "availability_request",
      strength: clamp(48 + prospect.salesScore * 0.15),
      recommendedAction: "confirm_stock_lead_time",
    };
  }

  if (b.comparisonMode) {
    return {
      opportunityType: "comparison_mode",
      strength: clamp(42 + 18),
      recommendedAction: "differentiate_without_attacking",
    };
  }

  if (tags.has("hesitant") || prospect.objections.length > 0) {
    return {
      opportunityType: "hesitation",
      strength: clamp(38 + prospect.objections.length * 8),
      recommendedAction: "reassure_micro_proof",
    };
  }

  if ((b.silentPeriods ?? 0) >= 1 && prospect.interestLevel === "warm") {
    return {
      opportunityType: "short_silence_window",
      strength: clamp(35),
      recommendedAction: "light_check_in_one_question",
    };
  }

  if (prospect.interestLevel === "cold" && tags.has("inactive")) {
    return {
      opportunityType: "cold_lead_reactivation",
      strength: clamp(28),
      recommendedAction: "soft_value_ping",
    };
  }

  return {
    opportunityType: "none",
    strength: clamp(15 + prospect.salesScore * 0.1),
    recommendedAction: "maintain_rapport_light_next_step",
  };
}
