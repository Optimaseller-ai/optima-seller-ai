/**
 * Urgence réaliste — signaux business uniquement (pas d’invention client).
 */

import type { SalesBrainBusinessContext } from "./sales-brain-types";

export type UrgencyLevel = "low" | "medium" | "high";

export type UrgencyCue = {
  level: UrgencyLevel;
  /** Une phrase courte max — optionnelle pour le générateur. */
  hintPhrase?: string;
};

/**
 * Combine flags stock / demande / promo / délai — reste sobre.
 */
export function computeRealisticUrgency(
  ctx: SalesBrainBusinessContext,
  lang: "fr" | "en" | "es",
): UrgencyCue {
  let score = 0;
  if (ctx.stockLimited) score += 1;
  if (ctx.highDemandSKU) score += 1;
  if (ctx.promoActive) score += 1;
  if (typeof ctx.deliveryLagDays === "number" && ctx.deliveryLagDays >= 5) score += 1;

  const level: UrgencyLevel = score >= 3 ? "high" : score >= 1 ? "medium" : "low";

  if (level === "low") return { level };

  if (lang === "en") {
    if (ctx.promoActive && ctx.stockLimited)
      return { level: "medium", hintPhrase: " Promo on this ref while stock lasts." };
    if (ctx.highDemandSKU) return { level: "medium", hintPhrase: " This one moves fast lately." };
    if (typeof ctx.deliveryLagDays === "number" && ctx.deliveryLagDays >= 5)
      return { level: "medium", hintPhrase: " Slots fill up — earlier is calmer." };
    return { level, hintPhrase: " Worth locking if it fits you." };
  }
  if (lang === "es") {
    return { level, hintPhrase: " Suele volar cuando hay buen stock." };
  }
  if (ctx.promoActive && ctx.stockLimited) {
    return { level: "medium", hintPhrase: " Promo en cours sur cette ref tant qu’il reste du stock." };
  }
  if (ctx.highDemandSKU) {
    return { level: "medium", hintPhrase: " Ça part vite en ce moment." };
  }
  if (typeof ctx.deliveryLagDays === "number" && ctx.deliveryLagDays >= 5) {
    return { level: "medium", hintPhrase: " Les créneaux partent — plutôt quand c’est calme." };
  }
  return { level, hintPhrase: " Ça vaut le coup de verrouiller si ça te convient." };
}
