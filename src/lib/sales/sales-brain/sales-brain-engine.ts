/**
 * Cerveau vente — lit prospect-core uniquement, enchaîne détection → stratégie → action.
 * Sortie consommée par l’agent / automation (pas une réponse longue).
 */

import { closingLine, pickCloseLevel } from "./closing-engine";
import { latestObjectionCategory, objectionResponseHint } from "./objection-handler";
import { detectSalesOpportunity } from "./sales-opportunity-detector";
import type {
  SalesBrainBusinessContext,
  SalesBrainConversationContext,
  SalesBrainInput,
  SalesBrainMessageStyle,
  SalesBrainNextAction,
  SalesBrainOutput,
} from "./sales-brain-types";
import { composeSalesBrainMessage } from "./sales-message-generator";
import { selectSalesStrategy } from "./sales-strategy-selector";
import { computeRealisticUrgency } from "./urgency-engine";

function clampConfidence(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function messageStyleFromStrategy(strategy: string): SalesBrainMessageStyle {
  switch (strategy) {
    case "premium_handling":
      return "premium_soft";
    case "education":
    case "reactivation_soft":
      return "educational_light";
    case "reassurance":
      return "reassuring";
    default:
      return "ultra_short_whatsapp";
  }
}

function decideNextAction(args: {
  tags: Set<string>;
  strategy: string;
  opportunityType: string;
  hasTypedObjection: boolean;
  interestLevel: string;
  closeBucket: "soft_close" | "medium_close" | "hard_close";
}): SalesBrainNextAction {
  const { tags, strategy, opportunityType, hasTypedObjection, interestLevel, closeBucket } = args;

  if (tags.has("vip")) return "vip_concierge";

  if (strategy === "reassurance" && hasTypedObjection) return "handle_objection";

  if (strategy === "closing" || opportunityType === "buy_intent") {
    if (closeBucket === "hard_close") return "confirm_now";
    if (closeBucket === "medium_close") return "send_order_details";
    return "soft_close_step";
  }

  if (strategy === "reactivation_soft" || opportunityType === "cold_lead_reactivation") {
    return "reactivate_ping";
  }

  if (strategy === "education") {
    if (opportunityType === "availability_request") return "qualify_micro";
    if (opportunityType === "short_silence_window") return "hold_light_touch";
    return "educate_product_fit";
  }

  if (strategy === "persuasion") {
    if (
      opportunityType === "comparison_mode" ||
      opportunityType === "price_request" ||
      opportunityType === "returning_customer"
    ) {
      return "persuade_pair_options";
    }
    return "qualify_micro";
  }

  if (strategy === "premium_handling") return "vip_concierge";

  if (interestLevel === "cold") return "educate_product_fit";
  return "qualify_micro";
}

function blendConfidence(prospectConfidence: number, opportunityStrength: number) {
  return clampConfidence(prospectConfidence * 0.45 + opportunityStrength * 0.55);
}

/** Contexte métier résolu sans lire le chat — lie ville stockée sur le prospect si absente du businessContext. */
function resolveBusinessContext(
  prospectCity: string | null | undefined,
  biz?: SalesBrainBusinessContext,
): SalesBrainBusinessContext {
  const base = biz ?? {};
  return {
    ...base,
    cityShipping: base.cityShipping ?? prospectCity ?? undefined,
  };
}

/**
 * Flux : profil core → intention / opportunité → stratégie → action → message guide.
 * `conversationContext` reste optionnel — jamais de transcript brut requis.
 */
export function runSalesBrain(input: SalesBrainInput): SalesBrainOutput {
  const prospect = input.prospectProfile;
  const conv: SalesBrainConversationContext = input.conversationContext ?? {};
  const lang = prospect.preferredLanguage ?? "fr";
  const tags = new Set(prospect.tags);
  const business = resolveBusinessContext(prospect.city, input.businessContext);

  const opportunity = detectSalesOpportunity(prospect);
  const strategyPick = selectSalesStrategy(prospect, opportunity);
  const objectionCategory = latestObjectionCategory(prospect);
  const hasTypedObjection = prospect.objections.length > 0 && objectionCategory !== "unknown";

  const closeLevel = pickCloseLevel(prospect);
  const nextAction = decideNextAction({
    tags,
    strategy: strategyPick.strategy,
    opportunityType: opportunity.opportunityType,
    hasTypedObjection,
    interestLevel: prospect.interestLevel,
    closeBucket: closeLevel,
  });

  const urgencyCue = computeRealisticUrgency(business, lang);
  const messageStyle = messageStyleFromStrategy(strategyPick.strategy);

  const shippingCity = business.cityShipping ?? prospect.city ?? undefined;

  let anchoredPhrase: string | undefined;

  if (nextAction === "handle_objection") {
    anchoredPhrase = objectionResponseHint(objectionCategory, lang, shippingCity);
  } else if (nextAction === "soft_close_step" || nextAction === "send_order_details" || nextAction === "confirm_now") {
    anchoredPhrase = closingLine(closeLevel, lang);
  }

  if (urgencyCue.level === "high" && urgencyCue.hintPhrase && !anchoredPhrase) {
    anchoredPhrase = urgencyCue.hintPhrase.trim();
  }

  const suggestedBuyerLine = composeSalesBrainMessage({
    prospect,
    strategy: strategyPick.strategy,
    opportunity,
    anchoredPhrase,
    lang,
  });

  const confidence = blendConfidence(prospect.confidenceScore, opportunity.strength);

  const automationHint = [
    "sales_brain",
    nextAction,
    opportunity.opportunityType,
    strategyPick.strategy,
    conv.pipelineHint ?? "",
  ]
    .filter(Boolean)
    .join(":");

  return {
    nextAction,
    confidence,
    strategy: strategyPick.strategy,
    messageStyle,
    urgencyLevel: urgencyCue.level,
    suggestedBuyerLine,
    automationHint,
  };
}
