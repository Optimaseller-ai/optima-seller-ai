/**
 * Closing par niveaux — messages courts style WhatsApp.
 */

import type { ProspectCoreProfile } from "@/lib/crm/prospect-core/prospect-profile";

export type CloseLevel = "soft_close" | "medium_close" | "hard_close";

export function pickCloseLevel(prospect: ProspectCoreProfile): CloseLevel {
  if (prospect.interestLevel === "ready") return "hard_close";
  if (prospect.interestLevel === "hot" && prospect.salesScore >= 68) return "medium_close";
  if (prospect.lastIntentSummary === "purchase_intent") return "medium_close";
  return "soft_close";
}

export function closingLine(level: CloseLevel, lang: "fr" | "en" | "es"): string {
  if (lang === "en") {
    if (level === "soft_close") return "I can hold it for you if you want.";
    if (level === "medium_close") return "I’ll send you the order details now.";
    return "I can lock it in now if you’re ready.";
  }
  if (lang === "es") {
    if (level === "soft_close") return "Te lo puedo reservar si te encaja.";
    if (level === "medium_close") return "Te mando el detalle del pedido.";
    return "Lo cierro ahora si me das el ok.";
  }
  if (level === "soft_close") return "Je peux vous le réserver si vous voulez.";
  if (level === "medium_close") return "Je vous envoie les détails commande.";
  return "Je peux valider maintenant si vous êtes prêt.";
}
