/**
 * Types partagés sales-brain — aucun message chat brut requis.
 */

import type { ProspectCoreProfile } from "@/lib/crm/prospect-core/prospect-profile";

/** Contexte métier (stock, promo…) — pas transcript. */
export type SalesBrainBusinessContext = {
  promoActive?: boolean;
  stockLimited?: boolean;
  highDemandSKU?: boolean;
  deliveryLagDays?: number;
  cityShipping?: string;
};

/**
 * Tranche conversation dérivée du core / automation — jamais obligatoire ;
 * si vide, le cerveau n’utilise que le profil.
 */
export type SalesBrainConversationContext = {
  topicFocus?: string;
  pipelineHint?: string;
};

export type SalesBrainInput = {
  prospectProfile: ProspectCoreProfile;
  conversationContext?: SalesBrainConversationContext;
  businessContext?: SalesBrainBusinessContext;
};

export type SalesBrainMessageStyle = "ultra_short_whatsapp" | "premium_soft" | "educational_light" | "reassuring";

export type SalesBrainNextAction =
  | "educate_product_fit"
  | "qualify_micro"
  | "handle_objection"
  | "persuade_pair_options"
  | "soft_close_step"
  | "send_order_details"
  | "confirm_now"
  | "reactivate_ping"
  | "vip_concierge"
  | "hold_light_touch";

export type SalesBrainOutput = {
  nextAction: SalesBrainNextAction;
  confidence: number;
  strategy: string;
  messageStyle: SalesBrainMessageStyle;
  urgencyLevel: "low" | "medium" | "high";
  /** Ligne unique max — prête à guider l’agent ; pas un pavé. */
  suggestedBuyerLine?: string;
  /** Pour automation / execution layer. */
  automationHint?: string;
};
