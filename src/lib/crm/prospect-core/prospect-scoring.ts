/**
 * Score commercial 0–100 — déterministe, réutilisable automation / relances.
 */

import type { ProspectCoreProfile, ProspectInterestLevel } from "./prospect-profile";

export type ProspectScoringSignals = {
  askedPrice?: boolean;
  askedDelivery?: boolean;
  gaveEmail?: boolean;
  askedPurchase?: boolean;
  longSilence?: boolean;
  spamLike?: boolean;
  urgentLanguage?: boolean;
  comparisonLanguage?: boolean;
  repeatVisit?: boolean;
};

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Règles demandées produit + bornes cold / warm / hot / ready */
export function computeSalesScoreDelta(signals: ProspectScoringSignals): number {
  let d = 0;
  if (signals.askedPrice) d += 20;
  if (signals.askedDelivery) d += 30;
  if (signals.gaveEmail) d += 40;
  if (signals.askedPurchase) d += 50;
  if (signals.longSilence) d -= 10;
  if (signals.spamLike) d -= 20;
  if (signals.urgentLanguage) d += 12;
  if (signals.comparisonLanguage) d += 8;
  if (signals.repeatVisit) d += 15;
  return d;
}

export function scoreToInterestLevel(score: number): ProspectInterestLevel {
  if (score >= 90) return "ready";
  if (score >= 71) return "hot";
  if (score >= 31) return "warm";
  return "cold";
}

export function applySalesScore(profile: ProspectCoreProfile, signals: ProspectScoringSignals): ProspectCoreProfile {
  const delta = computeSalesScoreDelta(signals);
  const salesScore = clampScore(profile.salesScore + delta);
  const interestLevel = scoreToInterestLevel(salesScore);
  return {
    ...profile,
    salesScore,
    interestLevel,
    updatedAt: Date.now(),
  };
}

/** Met à jour aussi confidenceScore (léger — pas doublon scoring principal). */
export function bumpConfidence(profile: ProspectCoreProfile, delta: number): ProspectCoreProfile {
  return {
    ...profile,
    confidenceScore: clampScore(profile.confidenceScore + delta),
    updatedAt: Date.now(),
  };
}
