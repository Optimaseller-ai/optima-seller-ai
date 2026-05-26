/**
 * Détection fatigue relance — trop de pings, faible engagement, prospect qui ignore.
 */

import "server-only";

import type { ConversationAutomationContext } from "./types";
import { analyzeTriggerSignals } from "./triggers/trigger-signals";

export type FollowupFatigueLevel = "none" | "low" | "medium" | "high";

export type FollowupFatigueReport = {
  level: FollowupFatigueLevel;
  /** 0–100 — plus c’est haut, plus il faut espacer. */
  score: number;
  reasons: string[];
  shouldReduceFrequency: boolean;
  /** Délai minimum recommandé avant prochaine relance commerciale. */
  recommendedMinGapMinutes: number;
};

function levelFromScore(score: number): FollowupFatigueLevel {
  if (score >= 72) return "high";
  if (score >= 42) return "medium";
  if (score >= 18) return "low";
  return "none";
}

/**
 * Analyse prospect + historique agrégé (pas le transcript brut complet).
 */
export function detectFollowupFatigue(ctx: ConversationAutomationContext): FollowupFatigueReport {
  const reasons: string[] = [];
  let score = 0;

  const signals = analyzeTriggerSignals(ctx);
  const relance = ctx.relanceCount ?? 0;
  const turns = ctx.conversationState?.stats?.turn_count ?? 0;
  const fatigueStat = ctx.conversationState?.stats?.fatigue ?? 0;
  const trust = ctx.conversationState?.salesSignalsMemory?.trustLevel01;
  const habits = ctx.conversationState?.socialConversationHabits ?? [];
  const intentScore = ctx.conversationState?.salesSignalsMemory?.lastIntentScore;

  if (relance >= 4) {
    score += 28;
    reasons.push(`relances_élevées_${relance}`);
  } else if (relance >= 2) {
    score += 14;
    reasons.push(`relances_répétées_${relance}`);
  }

  if (turns >= 6 && relance >= 2 && !signals.purchaseIntent) {
    score += 12;
    reasons.push("beaucoup_de_tours_sans_conversion");
  }

  if (signals.prospectSilent && relance >= 1) {
    score += 18;
    reasons.push("silence_prospect_après_relances");
  }

  if (habits.includes("late_replies")) {
    score += 10;
    reasons.push("habitude_réponses_tardives");
  }

  if (typeof trust === "number" && trust < 0.35) {
    score += 16;
    reasons.push("confiance_faible");
  }

  if (typeof intentScore === "number" && intentScore < 35) {
    score += 12;
    reasons.push("score_intention_faible");
  }

  if (fatigueStat >= 3) {
    score += 15;
    reasons.push("fatigue_conversation_élevée");
  }

  const lastUserLen = ctx.conversationState?.salesSignalsMemory?.lastUserChars ?? ctx.lastUserMessage?.length ?? 0;
  if (lastUserLen > 0 && lastUserLen < 12 && relance >= 2) {
    score += 8;
    reasons.push("réponses_très_courtes_répétées");
  }

  if (signals.prospectAngry || signals.complaint) {
    score += 20;
    reasons.push("tension_émotionnelle");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = levelFromScore(score);

  const recommendedMinGapMinutes =
    level === "high" ? 24 * 60 : level === "medium" ? 6 * 60 : level === "low" ? 90 : 45;

  return {
    level,
    score,
    reasons,
    shouldReduceFrequency: level === "medium" || level === "high",
    recommendedMinGapMinutes,
  };
}
