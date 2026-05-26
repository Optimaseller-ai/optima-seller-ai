/**
 * Profil CRM central OPTIMA — une base unique par prospect (pas seulement le fil chat).
 */

export type ProspectInterestLevel = "cold" | "warm" | "hot" | "ready";

export type ProspectBuyingStage =
  | "unknown"
  | "awareness"
  | "consideration"
  | "decision"
  | "purchase"
  | "post_purchase";

/** Tags comportement / segmentation — enrichis automatiquement par prospect-enrichment. */
export type ProspectTag =
  | "new"
  | "hot-lead"
  | "hesitant"
  | "vip"
  | "price-sensitive"
  | "urgent"
  | "loyal"
  | "inactive"
  | "repeat-customer";

export type ProspectBehaviorSignals = {
  fastResponder?: boolean;
  priceSensitive?: boolean;
  comparisonMode?: boolean;
  /** Nombre de fenêtres silence détectées ou score agrégé selon contexte. */
  silentPeriods?: number;
};

export type ProspectConversationTurn = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

export type ProspectCoreProfile = {
  /** Stable par chat — 1 session = 1 prospect (réconciliable plus tard par téléphone/email). */
  id: string;
  /** sessionId technique — clé primaire store « un chat ». */
  sessionId: string;
  agentId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  /** 0–1 si inféré (sinon undefined). */
  genderConfidence?: number;
  preferredLanguage?: "fr" | "en" | "es";
  interestLevel: ProspectInterestLevel;
  buyingStage: ProspectBuyingStage;
  budgetRange?: string | null;
  interestedProducts: string[];
  lastInteraction: number;
  conversationHistory: ProspectConversationTurn[];
  tags: ProspectTag[];
  behaviorSignals: ProspectBehaviorSignals;
  /** Score commercial agrégé 0–100 — source prospect-scoring. */
  salesScore: number;
  /** Dernière intention détectée (heuristique). */
  lastIntentSummary?: string;
  /** Objections récentes (extraits courts). */
  objections: string[];
  /** Confiance agrégée mise à jour temps réel 0–100. */
  confidenceScore: number;
  /** Indice humeur / tonalité prospect (-1 à 1). */
  moodEstimate?: number;
  createdAt: number;
  updatedAt: number;
};

const MAX_HISTORY_TURNS = 80;

export function emptyProspectCoreProfile(args: {
  id: string;
  sessionId: string;
  agentId: string;
  name?: string;
}): ProspectCoreProfile {
  const now = Date.now();
  return {
    id: args.id,
    sessionId: args.sessionId,
    agentId: args.agentId,
    name: args.name?.trim() || "Prospect",
    interestedProducts: [],
    lastInteraction: now,
    conversationHistory: [],
    tags: ["new"],
    behaviorSignals: {},
    salesScore: 15,
    interestLevel: "cold",
    buyingStage: "unknown",
    objections: [],
    confidenceScore: 40,
    createdAt: now,
    updatedAt: now,
  };
}

export function trimProspectConversationHistory(profile: ProspectCoreProfile): ProspectCoreProfile {
  if (profile.conversationHistory.length <= MAX_HISTORY_TURNS) return profile;
  return {
    ...profile,
    conversationHistory: profile.conversationHistory.slice(-MAX_HISTORY_TURNS),
    updatedAt: Date.now(),
  };
}

export function uniqueProspectTags(tags: ProspectTag[]): ProspectTag[] {
  return [...new Set(tags)];
}
