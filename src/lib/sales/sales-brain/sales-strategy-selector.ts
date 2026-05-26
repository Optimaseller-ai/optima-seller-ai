/**
 * Choix de stratégie — guidé par le profil core (température, tags).
 */

import type { ProspectCoreProfile } from "@/lib/crm/prospect-core/prospect-profile";
import type { SalesOpportunitySignal } from "./sales-opportunity-detector";

export type SalesStrategyKey =
  | "education"
  | "persuasion"
  | "closing"
  | "premium_handling"
  | "reassurance"
  | "reactivation_soft";

export type SalesStrategyPick = {
  strategy: SalesStrategyKey;
  /** Indications très courtes pour le prompt métier — pas une réponse client. */
  tacticHints: string[];
};

export function selectSalesStrategy(
  prospect: ProspectCoreProfile,
  opportunity: SalesOpportunitySignal,
): SalesStrategyPick {
  const tags = new Set(prospect.tags);

  if (tags.has("vip")) {
    return {
      strategy: "premium_handling",
      tacticHints: ["Calme.", "Une option premium + une fallback.", "Jamais presser."],
    };
  }

  if (tags.has("hesitant") || opportunity.opportunityType === "hesitation") {
    return {
      strategy: "reassurance",
      tacticHints: ["Concret.", "Une preuve simple.", "Question fermée courte."],
    };
  }

  if (prospect.interestLevel === "cold" || opportunity.opportunityType === "cold_lead_reactivation") {
    return {
      strategy: prospect.tags.includes("inactive") ? "reactivation_soft" : "education",
      tacticHints: ["Valeur en 1 phrase.", "Chercher le vrai besoin.", "Pas de barrage de questions."],
    };
  }

  if (prospect.interestLevel === "warm" || prospect.interestLevel === "hot") {
    if (opportunity.opportunityType === "buy_intent" || prospect.interestLevel === "hot") {
      return {
        strategy: "closing",
        tacticHints: ["Micro-étape suivante.", "Offrir réservation ou détails commande.", "Ton sûr mais léger."],
      };
    }
    return {
      strategy: "persuasion",
      tacticHints: ["Comparer 2 options max.", "Accrocher au besoin déjà dit.", "Court."],
    };
  }

  if (prospect.interestLevel === "ready") {
    return {
      strategy: "closing",
      tacticHints: ["Valider le GO.", "Proposer validation immédiate ou récap court.", "Pas de blabla."],
    };
  }

  return {
    strategy: "education",
    tacticHints: ["Clarifier l’usage.", "Offrir 1 chemin simple.", "WhatsApp humain."],
  };
}
