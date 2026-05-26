/**
 * Phrases très courtes — guidées par prospect-core uniquement (aucun scraping du chat brut).
 */

import type { ProspectCoreProfile } from "@/lib/crm/prospect-core/prospect-profile";

import type { SalesOpportunitySignal } from "./sales-opportunity-detector";
import type { SalesStrategyKey } from "./sales-strategy-selector";

export type SalesMessageGeneratorInput = {
  prospect: ProspectCoreProfile;
  strategy: SalesStrategyKey;
  opportunity: SalesOpportunitySignal;
  /** Déjà formulée — prioritaire (objection / close / urgence). */
  anchoredPhrase?: string;
  lang: "fr" | "en" | "es";
};

function firstToken(name: string) {
  return String(name ?? "").trim().split(/\s+/)[0] || "toi";
}

/**
 * Une seule pulsation WhatsApp — pas de pavé, pas de ton « assistant ».
 */
export function composeSalesBrainMessage(input: SalesMessageGeneratorInput): string {
  const { prospect, strategy, opportunity, anchoredPhrase, lang } = input;
  const yo = firstToken(prospect.name);

  if (anchoredPhrase?.trim()) {
    const t = anchoredPhrase.trim();
    if (lang === "fr" && yo.length < 16 && !/\?$/.test(t)) {
      return `${yo}, ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
    }
    return t;
  }

  if (lang === "en") {
    if (strategy === "premium_handling")
      return `${yo}, I lined up your best-fit option — want the calm recap?`;
    if (opportunity.opportunityType === "availability_request") return `${yo}, I can confirm stock + ETA in one message.`;
    if (opportunity.opportunityType === "comparison_mode") return `${yo}, two honest picks — tell me your main constraint.`;
    if (opportunity.opportunityType === "short_silence_window") return `${yo}, still on it — one detail I should nail for you?`;
    if (opportunity.opportunityType === "cold_lead_reactivation" || strategy === "reactivation_soft")
      return `${yo}, quick ping — still looking for something in this range?`;
    if (strategy === "education") return `${yo}, what’s the real use-case — daily or occasional?`;
    return `${yo}, shall I park the simplest next step for you?`;
  }

  if (lang === "es") {
    if (strategy === "premium_handling") return `${yo}, te dejo la opción más limpia — ¿te paso el resumen corto?`;
    if (opportunity.opportunityType === "availability_request") return `${yo}, te confirmo stock y plazo en un mensaje.`;
    if (opportunity.opportunityType === "comparison_mode") return `${yo}, dos opciones claras — ¿qué restricción manda más?`;
    if (opportunity.opportunityType === "short_silence_window") return `${yo}, ¿sigue en pie — qué detalle falta?`;
    if (opportunity.opportunityType === "cold_lead_reactivation" || strategy === "reactivation_soft")
      return `${yo}, ¿sigues buscando algo así?`;
    if (strategy === "education") return `${yo}, ¿uso diario u ocasional?`;
    return `${yo}, ¿te dejo el siguiente paso más simple?`;
  }

  if (strategy === "premium_handling")
    return `${yo}, je t’ai calé l’option la plus propre — je t’envoie le recap court ?`;
  if (opportunity.opportunityType === "availability_request")
    return `${yo}, je te confirme stock + délai en une phrase si tu veux.`;
  if (opportunity.opportunityType === "comparison_mode") return `${yo}, deux choix nets — ta vraie contrainte c’est quoi ?`;
  if (opportunity.opportunityType === "short_silence_window")
    return `${yo}, t’as pu regarder — y’a un détail qui bloque ?`;
  if (opportunity.opportunityType === "cold_lead_reactivation" || strategy === "reactivation_soft")
    return `${yo}, petit ping — tu cherches encore dans ce style ?`;
  if (strategy === "education") return `${yo}, c’est pour un usage tous les jours ou plutôt ponctuel ?`;
  return `${yo}, je te propose l’étape suivante la plus simple — ok pour toi ?`;
}
