import "server-only";

import { ANTI_AI_PHRASE_BLACKLIST } from "./phrase-blacklist";

export type AntiAiFilterResult = {
  text: string;
  removedPhraseHits: number;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Supprime les occurrences des phrases blacklistées (insensible à la casse). */
export function stripBlacklistedPhrases(text: string, extraBlacklist: string[] = []): AntiAiFilterResult {
  let out = String(text ?? "").trim();
  let hits = 0;
  const all = [...ANTI_AI_PHRASE_BLACKLIST, ...extraBlacklist.map((x) => x.trim()).filter(Boolean)];
  for (const phrase of all) {
    if (!phrase) continue;
    const re = new RegExp(escapeRegex(phrase), "gi");
    const before = out;
    out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
    if (before !== out) hits += 1;
  }
  return { text: out, removedPhraseHits: hits };
}

/** Motifs « corporate / IA » à adoucir ou retirer. */
export function stripAssistantMetaLanguage(text: string): string {
  return String(text ?? "")
    .replace(/\b(en tant qu['’]assistant|en tant qu['’]ia|je suis une ia|je suis une intelligence artificielle)\b/gi, "")
    .replace(/\b(nous vous informons que|il est important de noter que|pour résumer|en conclusion)\b/gi, "")
    .replace(/\b(officiellement|veuillez|nous\s+vous\s+informons|conformément)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Fermetures génériques souvent trop « script » en fin de message. */
export function stripTrailingScriptClosings(text: string): string {
  return String(text ?? "")
    .replace(/\b(à bientôt|bonne journée|bonne soirée)\b\.?$/i, "")
    .replace(/\s*\?\s*$/, "")
    .trim();
}

export function runAntiAiFilterPass(text: string, extraBlacklist?: string[]): AntiAiFilterResult {
  const a = stripBlacklistedPhrases(text, extraBlacklist);
  const b = stripAssistantMetaLanguage(a.text);
  const c = stripTrailingScriptClosings(b);
  return { text: c, removedPhraseHits: a.removedPhraseHits };
}
