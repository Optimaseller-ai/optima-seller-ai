import "server-only";

import { decideAudioReply, type AudioDecisionInput } from "./audio-decision-engine";
import { synthesizeVoiceReply } from "../generation/voice-generation-engine";
import { readAudioMemory, mergeAudioMemory } from "../memory/audio-memory";
import { checkVoiceReplyAllowed, sanitizeTextForVoice } from "../safety/audio-safety";
import { buildHumanAudioTimingPlan } from "../timing/human-audio-timing";

export type VoiceResponsePlan = {
  mode: "text" | "voice";
  text: string;
  audio?: {
    audioBase64: string;
    mimeType: string;
    durationMs: number;
  };
  timing?: ReturnType<typeof buildHumanAudioTimingPlan>;
  decisionReasons: string[];
};

export async function planVoiceOrTextResponse(args: {
  assistantText: string;
  personaKey?: string | null;
  gender?: "male" | "female";
  conversationState?: unknown;
  userSentVoice: boolean;
  userMessage: string;
  emotion?: AudioDecisionInput["emotion"];
  lastAgentVoiceAt?: string;
  seed?: string;
}): Promise<VoiceResponsePlan> {
  const text = sanitizeTextForVoice(args.assistantText);
  const memory = readAudioMemory(args.conversationState);

  const decision = decideAudioReply({
    userSentVoice: args.userSentVoice,
    userMessage: args.userMessage,
    assistantText: text,
    emotion: args.emotion,
    audioMemory: memory,
    isComplexExplanation: text.length > 120 && text.length < 320,
    isWarmFollowup: /\b(relance|toujours|dispo)\b/i.test(text),
    userEmotional:
      args.emotion === "frustration" ||
      args.emotion === "hesitation" ||
      args.emotion === "confusion",
  });

  if (!decision.shouldReplyWithVoice) {
    return { mode: "text", text, decisionReasons: decision.reasons };
  }

  const synth = await synthesizeVoiceReply({
    text,
    personaKey: args.personaKey,
    gender: args.gender,
  });

  if (!synth) {
    return {
      mode: "text",
      text,
      decisionReasons: [...decision.reasons, "Synthèse vocale indisponible — texte."],
    };
  }

  const safety = checkVoiceReplyAllowed({
    memory,
    textLength: text.length,
    durationMs: synth.durationEstimateMs,
    lastAgentVoiceAt: args.lastAgentVoiceAt,
  });

  if (!safety.allowed) {
    return {
      mode: "text",
      text,
      decisionReasons: [...decision.reasons, safety.reason ?? "safety"],
    };
  }

  const timing = buildHumanAudioTimingPlan({
    textLength: text.length,
    durationEstimateMs: synth.durationEstimateMs,
    seed: args.seed ?? text,
    userSentVoice: args.userSentVoice,
  });

  return {
    mode: "voice",
    text,
    audio: {
      audioBase64: synth.audioBase64,
      mimeType: synth.mimeType,
      durationMs: synth.durationEstimateMs,
    },
    timing,
    decisionReasons: decision.reasons,
  };
}

export function patchConversationStateWithAudioMemory(
  conversationState: Record<string, unknown>,
  obs: Parameters<typeof mergeAudioMemory>[1],
): Record<string, unknown> {
  const prev = readAudioMemory(conversationState);
  return {
    ...conversationState,
    audioMemory: mergeAudioMemory(prev, obs),
  };
}
