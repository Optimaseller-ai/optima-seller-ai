/**
 * Enrichissement tags / signaux — décisions relance — pont automation & sales brain.
 */

import type { LeadTemperature, SmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import { mergeSmartProspectProfile } from "@/lib/prospect/lead-profile/prospect-profile";
import type { ConversationAutomationContext } from "@/lib/automation/types";
import type { ProspectCoreProfile, ProspectInterestLevel, ProspectTag } from "./prospect-profile";
import { uniqueProspectTags } from "./prospect-profile";

export function detectSpamLikeMessage(text: string): boolean {
  const m = String(text ?? "").trim();
  if (m.length > 600 && /(.)\1{12,}/i.test(m)) return true;
  if ((m.match(/🤑|💸|FREE MONEY|viagra|crypto bot/gi) ?? []).length >= 2) return true;
  return false;
}

export function deriveProspectTags(profile: ProspectCoreProfile, lastUserMessage?: string): ProspectTag[] {
  const tags = new Set<ProspectTag>(profile.tags);
  const msg = String(lastUserMessage ?? "").toLowerCase();
  const now = Date.now();
  const idleH = (now - profile.lastInteraction) / 3_600_000;

  if (profile.salesScore >= 71) tags.add("hot-lead");
  if (/\b(urgent|vite|aujourd'hui|aujourd’hui|maintenant|rapidement)\b/i.test(msg)) tags.add("urgent");
  if (profile.behaviorSignals.priceSensitive || /\b(prix|budget|trop cher|économ|moins cher)\b/i.test(msg)) {
    tags.add("price-sensitive");
  }
  if (profile.behaviorSignals.comparisonMode || /\b(comparer|concurrent|ailleurs|amazon)\b/i.test(msg)) {
    tags.delete("hesitant");
  }
  if (profile.salesScore < 35 && /(\bhmm\b|pas sûr|hésit|je réfléchi)/i.test(msg)) tags.add("hesitant");
  if (idleH >= 48) tags.add("inactive");
  else tags.delete("inactive");
  if (profile.tags.includes("repeat-customer") || profile.behaviorSignals.silentPeriods) {
    /* silentPeriods utilisé aussi pour fidélité résurrection */
  }
  if (profile.objections.length >= 2) tags.add("hesitant");

  if (profile.conversationHistory.length >= 14) {
    tags.add("repeat-customer");
    tags.add("loyal");
  }

  const userTurns = profile.conversationHistory.filter((t) => t.role === "user").length;
  if (userTurns >= 3 || profile.salesScore >= 30) tags.delete("new");
  else tags.add("new");

  return uniqueProspectTags([...tags]);
}

export type ProspectFollowupDecision = {
  shouldFollowUp: boolean;
  priority: "low" | "normal" | "high" | "vip";
  delayMs: number;
  reason: string;
};

/**
 * Règles relance CRM — hot + silence 2h, cold + 24h, VIP prioritaire.
 */
export function decideFollowupFromProspectCore(
  profile: ProspectCoreProfile,
  nowMs: number = Date.now(),
): ProspectFollowupDecision {
  const idleMs = nowMs - profile.lastInteraction;
  const isVip = profile.tags.includes("vip");

  if (isVip && idleMs >= 45 * 60_000) {
    return { shouldFollowUp: true, priority: "vip", delayMs: 0, reason: "vip_priority_touch" };
  }

  if (profile.interestLevel === "hot" || profile.interestLevel === "ready") {
    if (idleMs >= 2 * 60 * 60_000) {
      return { shouldFollowUp: true, priority: "high", delayMs: 0, reason: "hot_no_answer_2h" };
    }
    return { shouldFollowUp: false, priority: "normal", delayMs: 0, reason: "hot_recent_contact" };
  }

  if (profile.interestLevel === "cold") {
    return {
      shouldFollowUp: idleMs >= 24 * 60 * 60_000,
      priority: "low",
      delayMs: Math.max(0, 24 * 60 * 60_000 - idleMs),
      reason: "cold_wait_24h_window",
    };
  }

  if (idleMs >= 6 * 60 * 60_000) {
    return { shouldFollowUp: true, priority: "normal", delayMs: 0, reason: "warm_reengage_6h" };
  }

  return { shouldFollowUp: false, priority: "normal", delayMs: 0, reason: "warm_recent" };
}

/** Bloc compact pour prompts sales — le moteur lit ONLY ça (pas l’historique brut chat). */
export function formatProspectCoreForSalesEngine(profile: ProspectCoreProfile): string {
  return [
    "PROSPECT_CORE (CRM — source unique, ne pas inventer hors ce bloc):",
    `- id=${profile.id} session=${profile.sessionId}`,
    `- name=${profile.name} city=${profile.city ?? "—"} country=${profile.country ?? "—"}`,
    `- contacts: phone=${profile.phone ?? "—"} email=${profile.email ?? "—"}`,
    `- language=${profile.preferredLanguage ?? "auto"} score=${profile.salesScore} band=${profile.interestLevel} stage=${profile.buyingStage}`,
    `- budget=${profile.budgetRange ?? "—"} products=${profile.interestedProducts.slice(0, 8).join("; ") || "—"}`,
    `- tags=${profile.tags.join(", ")}`,
    `- behavior: fast=${profile.behaviorSignals.fastResponder ?? false} priceSens=${profile.behaviorSignals.priceSensitive ?? false} compare=${profile.behaviorSignals.comparisonMode ?? false} silences=${profile.behaviorSignals.silentPeriods ?? 0}`,
    `- objections=${profile.objections.slice(-5).join(" | ") || "none"}`,
    `- intent=${profile.lastIntentSummary ?? "—"} confidence=${profile.confidenceScore} mood=${profile.moodEstimate ?? "—"}`,
    `- lastInteraction=${new Date(profile.lastInteraction).toISOString()}`,
  ].join("\n");
}

function coreInterestToLeadTemperature(level: ProspectInterestLevel): LeadTemperature {
  if (level === "ready") return "ready_to_buy";
  if (level === "hot") return "hot";
  if (level === "warm") return "warm";
  return "cold";
}

/** Hydrate SmartProspectProfile pour automation / état conversation — dérivé du core uniquement. */
export function mergeProspectCoreIntoSmartLead(
  base: SmartProspectProfile | undefined,
  core: ProspectCoreProfile,
): SmartProspectProfile {
  return mergeSmartProspectProfile(base, {
    id: core.id,
    name: core.name,
    email: core.email,
    phone: core.phone,
    city: core.city,
    primaryNeed: core.interestedProducts[0] ?? base?.primaryNeed ?? "",
    budget: core.budgetRange ?? base?.budget ?? null,
    interestLevel:
      core.interestLevel === "cold"
        ? "cold"
        : core.interestLevel === "warm"
          ? "warm"
          : "hot",
    preferredProducts: core.interestedProducts.length ? core.interestedProducts : base?.preferredProducts,
    conversationHistory: core.conversationHistory.map((t) => ({
      role: t.role,
      content: t.content,
      ts: new Date(t.ts).toISOString(),
    })),
    leadTemperature: coreInterestToLeadTemperature(core.interestLevel),
    lastInteraction: core.lastInteraction,
    language: core.preferredLanguage ?? base?.language,
    notes: [...(base?.notes ?? []), ...core.tags.map((t) => `tag:${t}`)].slice(-40),
    updatedAt: Date.now(),
  });
}

export function prospectCoreFromSmartLead(args: {
  agentId: string;
  sessionId: string;
  lead: SmartProspectProfile;
}): ProspectCoreProfile {
  const temp = args.lead.leadTemperature;
  const interest: ProspectInterestLevel =
    temp === "ready_to_buy" ? "ready" : temp === "hot" ? "hot" : temp === "warm" ? "warm" : "cold";
  const score = interest === "ready" ? 92 : interest === "hot" ? 78 : interest === "warm" ? 48 : 22;

  return {
    id: args.sessionId,
    sessionId: args.sessionId,
    agentId: args.agentId,
    name: args.lead.name || "Prospect",
    phone: args.lead.phone,
    email: args.lead.email,
    city: args.lead.city,
    country: null,
    preferredLanguage: args.lead.language,
    interestLevel: interest,
    buyingStage: "unknown",
    budgetRange: args.lead.budget,
    interestedProducts: args.lead.preferredProducts ?? [],
    lastInteraction: args.lead.lastInteraction ?? Date.now(),
    conversationHistory:
      args.lead.conversationHistory?.map((m, i) => ({
        role: m.role,
        content: m.content,
        ts: Date.parse(m.ts ?? "") || Date.now() - i * 1000,
      })) ?? [],
    tags: ["new"],
    behaviorSignals: {},
    salesScore: score,
    objections: [],
    confidenceScore: 45,
    createdAt: args.lead.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };
}

export function attachProspectCoreToAutomationContext(
  ctx: ConversationAutomationContext,
  core: ProspectCoreProfile,
): ConversationAutomationContext {
  const smart = mergeProspectCoreIntoSmartLead(ctx.prospectLead, core);
  return {
    ...ctx,
    prospectLead: smart,
    leadTemperature: smart.leadTemperature,
    lastProspectActiveAt: core.lastInteraction,
    relanceCount: ctx.relanceCount,
  };
}
