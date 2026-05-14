import "server-only";

import type { ProspectEmotion } from "../emotions/emotion-detector";
import { emotionDelayFactor } from "../emotions/emotion-detector";
import type { BusinessDaySlot } from "./time-context";

export type HumanTimingInput = {
  /** Texte utilisateur (longueur + ponctuation). */
  prospectMessage: string;
  emotion: ProspectEmotion;
  /** Créneau local boutique. */
  daySlot: BusinessDaySlot;
  /** Longueur de la réponse assistant prévue (estimation avant envoi : utiliser brouillon ou message user). */
  replyCharEstimate?: number;
};

function complexityScore(text: string): number {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  const words = t.split(/\s+/).length;
  const questions = (t.match(/\?/g) ?? []).length;
  const digits = (t.match(/\d/g) ?? []).length;
  return Math.min(1, words / 80 + questions * 0.12 + digits * 0.02);
}

/**
 * Délai total suggéré avant d’afficher / envoyer la réponse (ms).
 * Jamais 0 : une réponse instantanée paraît artificielle.
 */
export function computeHumanResponseDelayMs(input: HumanTimingInput): number {
  const readMs = Math.min(4500, 220 + String(input.prospectMessage ?? "").length * 18);
  const thinkMs = 280 + complexityScore(input.prospectMessage) * 1200;
  const typeMs = Math.min(3200, 120 + (input.replyCharEstimate ?? 80) * 22);

  let base = readMs * 0.35 + thinkMs * 0.45 + typeMs * 0.2;
  /** Friction : un peu plus de « lecture » avant de répondre. */
  if (input.emotion === "anger" || input.emotion === "frustration") {
    base += 380 + Math.min(1200, String(input.prospectMessage ?? "").length * 6);
  }
  base *= emotionDelayFactor(input.emotion);

  // Nuit locale : léger délai sup. (prise en main plus lente), sauf impatience.
  if ((input.daySlot === "night" || input.daySlot === "evening") && input.emotion !== "impatience") {
    base *= 1.08;
  }

  const jitter = ((String(input.prospectMessage).length * 13) % 180) - 90;
  const out = Math.round(base + jitter);

  const minDelay = input.emotion === "impatience" ? 350 : 520;
  const maxDelay = 9000;
  return Math.max(minDelay, Math.min(maxDelay, out));
}

/** Délai de frappe simulé pour une réponse déjà connue (ms). */
export function computeTypingDelayMs(replyText: string, emotion: ProspectEmotion): number {
  const len = String(replyText ?? "").length;
  const cps =
    emotion === "impatience" ? 42 : emotion === "hesitation" ? 22 : emotion === "anger" || emotion === "frustration" ? 19 : 30;
  let raw = 400 + (len / cps) * 1000;
  if (emotion === "anger" || emotion === "frustration") raw += 420;
  return Math.max(420, Math.min(8200, Math.round(raw)));
}
