import "server-only";

import type { ProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";

import type { AudioMemory } from "../memory/audio-memory-types";

export type AudioDecisionInput = {
  userSentVoice: boolean;
  userMessage: string;
  assistantText: string;
  emotion?: ProspectEmotion | string;
  audioMemory: AudioMemory;
  isComplexExplanation?: boolean;
  isWarmFollowup?: boolean;
  userEmotional?: boolean;
};

export type AudioDecisionResult = {
  shouldReplyWithVoice: boolean;
  score: number;
  reasons: string[];
};

export function decideAudioReply(input: AudioDecisionInput): AudioDecisionResult {
  const reasons: string[] = [];
  let score = 0;

  if (input.userSentVoice) {
    score += 35;
    reasons.push("Le prospect vient d’envoyer un vocal.");
  }

  if (input.audioMemory.prefersVoice) {
    score += 25;
    reasons.push("Le prospect utilise souvent la voix.");
  }

  if (input.userEmotional || input.emotion === "frustration" || input.emotion === "hesitation") {
    score += 15;
    reasons.push("Ton émotionnel — la voix rassure mieux.");
  }

  if (input.isComplexExplanation) {
    score += 12;
    reasons.push("Explication un peu longue — vocal plus humain.");
  }

  if (input.isWarmFollowup) {
    score += 18;
    reasons.push("Relance chaleureuse adaptée au vocal.");
  }

  const textLen = input.assistantText.length;
  if (textLen > 380) {
    score -= 30;
    reasons.push("Réponse trop longue pour un vocal naturel.");
  }
  if (textLen < 25) {
    score -= 15;
    reasons.push("Réponse trop courte — texte suffit.");
  }

  if (input.emotion === "anger") {
    score -= 40;
    reasons.push("Prospect agacé — privilégier texte calme.");
  }

  const shouldReplyWithVoice = score >= 42;

  return { shouldReplyWithVoice, score, reasons };
}
