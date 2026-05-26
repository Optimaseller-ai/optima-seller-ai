/**
 * Prospect Core — CRM vivant par session (source unique hors transcript brut).
 */

export type {
  ProspectCoreProfile,
  ProspectTag,
  ProspectInterestLevel,
  ProspectBuyingStage,
  ProspectBehaviorSignals,
  ProspectConversationTurn,
} from "./prospect-profile";
export {
  emptyProspectCoreProfile,
  trimProspectConversationHistory,
  uniqueProspectTags,
} from "./prospect-profile";

export {
  clampScore,
  computeSalesScoreDelta,
  scoreToInterestLevel,
  applySalesScore,
  bumpConfidence,
} from "./prospect-scoring";
export type { ProspectScoringSignals } from "./prospect-scoring";

export {
  detectSpamLikeMessage,
  deriveProspectTags,
  decideFollowupFromProspectCore,
  formatProspectCoreForSalesEngine,
  mergeProspectCoreIntoSmartLead,
  prospectCoreFromSmartLead,
  attachProspectCoreToAutomationContext,
} from "./prospect-enrichment";
export type { ProspectFollowupDecision } from "./prospect-enrichment";

export {
  prospectCoreStoreKey,
  getProspectCore,
  upsertProspectCore,
  getOrCreateProspectCore,
  linkProspectCoreByContact,
} from "./prospect-store";

export { applyProspectCoreMessageTurn } from "./prospect-updater";
export type { ProspectCoreMessageTurnInput } from "./prospect-updater";
