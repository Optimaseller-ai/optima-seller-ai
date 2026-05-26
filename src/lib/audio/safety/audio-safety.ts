import type { AudioMemory } from "../memory/audio-memory-types";

export type AudioSafetyLimits = {
  maxAgentVoiceRepliesPerConversation: number;
  maxAudioDurationMs: number;
  minMsBetweenVoiceReplies: number;
  maxCharsForVoice: number;
};

export const DEFAULT_AUDIO_SAFETY: AudioSafetyLimits = {
  maxAgentVoiceRepliesPerConversation: 4,
  maxAudioDurationMs: 90_000,
  minMsBetweenVoiceReplies: 120_000,
  maxCharsForVoice: 420,
};

export type AudioSafetyCheck = {
  allowed: boolean;
  reason?: string;
};

export function checkVoiceReplyAllowed(args: {
  memory: AudioMemory;
  textLength: number;
  durationMs: number;
  lastAgentVoiceAt?: string;
  limits?: AudioSafetyLimits;
}): AudioSafetyCheck {
  const lim = args.limits ?? DEFAULT_AUDIO_SAFETY;

  if (args.memory.agentVoiceRepliesSent >= lim.maxAgentVoiceRepliesPerConversation) {
    return { allowed: false, reason: "Limite de notes vocales agent atteinte pour cette conversation." };
  }

  if (args.durationMs > lim.maxAudioDurationMs) {
    return { allowed: false, reason: "Audio trop long — rester en texte." };
  }

  if (args.textLength > lim.maxCharsForVoice) {
    return { allowed: false, reason: "Message trop long pour une note vocale naturelle." };
  }

  if (args.lastAgentVoiceAt) {
    const elapsed = Date.now() - new Date(args.lastAgentVoiceAt).getTime();
    if (elapsed < lim.minMsBetweenVoiceReplies) {
      return { allowed: false, reason: "Délai minimum entre deux vocaux agent." };
    }
  }

  return { allowed: true };
}

export function sanitizeTextForVoice(text: string): string {
  let out = String(text ?? "").trim();
  out = out.replace(/```[\s\S]*?```/g, "");
  out = out.replace(/\*\*/g, "");
  out = out.replace(/^[-•]\s+/gm, "");
  out = out.replace(/\n{2,}/g, ". ");
  out = out.replace(/\s+/g, " ").trim();
  return out.slice(0, 500);
}
