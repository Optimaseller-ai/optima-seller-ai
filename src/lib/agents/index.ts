/**
 * Optima commercial agents — architecture modulaire.
 *
 * Couches :
 * - memory : état conversation, profil prospect, mémoire commerciale
 * - sales : intention, opportunité, cross-sell
 * - personality : agents catalogue + prompts persona
 * - timing : fuseau business, fenêtres silencieuses
 * - followups : relances, hold « je vérifie », traitement queue
 * - business-context : RAG catalogue + pipeline `generateAIReply`
 * - prompts : construction des prompts LLM (premium seller)
 */

export * as memory from "./memory";
export * as sales from "./sales";
export * as personality from "./personality";
export * as timing from "./timing";
export * as followups from "./followups";
export * as businessContext from "./business-context";
export * as prompts from "./prompts/premium";
