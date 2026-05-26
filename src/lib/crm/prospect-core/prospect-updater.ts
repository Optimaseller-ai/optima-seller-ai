/**
 * Moteur de mise à jour temps réel — chaque message enrichit le CRM (pas le chat seul).
 */

import "server-only";

import { normalizeContact } from "@/lib/prospect/lead-profile/prospect-profile";
import type { ProspectCoreProfile, ProspectConversationTurn } from "./prospect-profile";
import { trimProspectConversationHistory, uniqueProspectTags } from "./prospect-profile";
import { applySalesScore, bumpConfidence, type ProspectScoringSignals } from "./prospect-scoring";
import { deriveProspectTags, detectSpamLikeMessage } from "./prospect-enrichment";
import { getOrCreateProspectCore, upsertProspectCore } from "./prospect-store";

function inferIntentSummary(message: string): string {
  const m = String(message ?? "").toLowerCase();
  if (/\b(prix|combien|budget|tarif|cfa|€)\b/i.test(m)) return "price_inquiry";
  if (/\b(livraison|livrer|délai|expedition)\b/i.test(m)) return "delivery_inquiry";
  if (/\b(acheter|commande|je\s+prends|je\s+valide)\b/i.test(m)) return "purchase_intent";
  if (/\b(email|courriel|mail)\s*:/i.test(m) || /@/.test(m)) return "contact_share";
  if (/\b(disponible|stock)\b/i.test(m)) return "availability";
  return "general";
}

function extractObjectionSnippet(message: string): string | null {
  const m = String(message ?? "").trim();
  if (/\b(mais|par contre|trop cher|pas convaincu|hésite|pas sûr)\b/i.test(m) && m.length < 200) return m;
  return null;
}

function inferMoodDelta(message: string): number {
  const m = String(message ?? "").toLowerCase();
  if (/\b(merci|super|parfait|génial|👍)\b/i.test(m)) return 0.15;
  if (/\b(colère|arnaque|nul|honte)\b/i.test(m)) return -0.35;
  return 0;
}

function buildScoringSignalsFromMessage(message: string, profile: ProspectCoreProfile): ProspectScoringSignals {
  const m = String(message ?? "");
  const askedPrice = /\b(prix|combien|budget|tarif|cfa|€)\b/i.test(m);
  const askedDelivery = /\b(livraison|livrer|expedition|délai)\b/i.test(m);
  const gaveEmail = /@/.test(m) || /\bemail\s*:/i.test(m);
  const askedPurchase = /\b(acheter|commander|je\s+prends|je\s+valide)\b/i.test(m);
  const urgentLanguage = /\b(urgent|vite|aujourd'hui|aujourd’hui)\b/i.test(m);
  const comparisonLanguage = /\b(comparer|concurrent|ailleurs)\b/i.test(m);
  const idleMs = Date.now() - profile.lastInteraction;
  const longSilence = idleMs > 6 * 60 * 60_000;
  const spamLike = detectSpamLikeMessage(m);

  return {
    askedPrice,
    askedDelivery,
    gaveEmail,
    askedPurchase,
    longSilence,
    spamLike,
    urgentLanguage,
    comparisonLanguage,
    repeatVisit: profile.tags.includes("repeat-customer"),
  };
}

function updateBehaviorSignals(profile: ProspectCoreProfile, userMsg: string): ProspectCoreProfile {
  const hist = profile.conversationHistory;
  let fastResponder = profile.behaviorSignals.fastResponder;
  if (hist.length >= 2) {
    const prev = hist[hist.length - 1];
    const prev2 = hist[hist.length - 2];
    if (prev?.role === "user" && prev2?.role === "assistant") {
      const gap = prev.ts - prev2.ts;
      if (gap > 0 && gap < 120_000) fastResponder = true;
    }
  }
  const priceSensitive =
    profile.behaviorSignals.priceSensitive || /\b(prix|budget|trop cher)\b/i.test(userMsg);
  const comparisonMode =
    profile.behaviorSignals.comparisonMode || /\b(comparer|concurrent)\b/i.test(userMsg);
  let silentPeriods = profile.behaviorSignals.silentPeriods ?? 0;
  const idle = Date.now() - profile.lastInteraction;
  if (idle > 4 * 60 * 60_000) silentPeriods += 1;

  return {
    ...profile,
    behaviorSignals: {
      ...profile.behaviorSignals,
      fastResponder,
      priceSensitive,
      comparisonMode,
      silentPeriods,
    },
  };
}

export type ProspectCoreMessageTurnInput = {
  agentId: string;
  sessionId: string;
  userMessage: string;
  assistantMessage?: string;
  seed?: Partial<
    Pick<
      ProspectCoreProfile,
      "name" | "phone" | "email" | "city" | "country" | "preferredLanguage" | "budgetRange"
    >
  >;
  markVip?: boolean;
};

/**
 * Point d’entrée temps réel : persiste dans prospect-store et retourne le profil à jour.
 */
export function applyProspectCoreMessageTurn(input: ProspectCoreMessageTurnInput): ProspectCoreProfile {
  const contact = normalizeContact(input.userMessage);
  let profile = getOrCreateProspectCore({
    agentId: input.agentId,
    sessionId: input.sessionId,
    phone: contact.phone ?? input.seed?.phone,
    email: contact.email ?? input.seed?.email,
    name: input.seed?.name,
    city: input.seed?.city,
    country: input.seed?.country,
  });

  if (input.seed) {
    profile = {
      ...profile,
      ...input.seed,
      interestedProducts: profile.interestedProducts,
      tags: profile.tags,
      objections: profile.objections,
      conversationHistory: profile.conversationHistory,
    };
  }

  if (input.markVip) {
    profile.tags = uniqueProspectTags([...profile.tags, "vip"]);
  }

  const userTurn: ProspectConversationTurn = {
    role: "user",
    content: String(input.userMessage).slice(0, 8000),
    ts: Date.now(),
  };
  const turns: ProspectConversationTurn[] = [...profile.conversationHistory, userTurn];

  if (input.assistantMessage?.trim()) {
    turns.push({
      role: "assistant",
      content: String(input.assistantMessage).slice(0, 8000),
      ts: Date.now(),
    });
  }

  profile = {
    ...profile,
    conversationHistory: turns,
    lastInteraction: Date.now(),
    lastIntentSummary: inferIntentSummary(input.userMessage),
    phone: contact.phone ?? profile.phone,
    email: contact.email ?? profile.email,
  };

  const objection = extractObjectionSnippet(input.userMessage);
  if (objection) {
    profile.objections = [...profile.objections, objection].slice(-12);
  }

  profile = updateBehaviorSignals(profile, input.userMessage);

  const signals = buildScoringSignalsFromMessage(input.userMessage, profile);
  profile = applySalesScore(profile, signals);

  const mood = profile.moodEstimate ?? 0;
  profile = {
    ...profile,
    moodEstimate: Math.max(-1, Math.min(1, mood + inferMoodDelta(input.userMessage))),
    confidenceScore: Math.min(
      100,
      profile.confidenceScore + (signals.gaveEmail ? 8 : signals.askedPurchase ? 10 : 3),
    ),
  };

  profile = bumpConfidence(profile, signals.spamLike ? -15 : 0);

  profile.tags = deriveProspectTags(profile, input.userMessage);

  profile = trimProspectConversationHistory(profile);

  return upsertProspectCore(profile);
}
