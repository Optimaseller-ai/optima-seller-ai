import type { AudioMemory } from "./audio-memory-types";
import { EMPTY_AUDIO_MEMORY } from "./audio-memory-types";

export type { AudioMemory } from "./audio-memory-types";
export { EMPTY_AUDIO_MEMORY };

export function readAudioMemory(conversationState: unknown): AudioMemory {
  const raw = (conversationState as { audioMemory?: AudioMemory } | null)?.audioMemory;
  if (!raw || typeof raw !== "object") return EMPTY_AUDIO_MEMORY();
  return {
    ...EMPTY_AUDIO_MEMORY(),
    ...raw,
    activeVoiceHours: Array.isArray(raw.activeVoiceHours) ? raw.activeVoiceHours : [],
  };
}

export function mergeAudioMemory(
  previous: AudioMemory,
  obs: {
    userSentVoice?: boolean;
    userAudioDurationMs?: number;
    agentSentVoice?: boolean;
    hourLocal?: number;
  },
): AudioMemory {
  const next = { ...previous, updatedAt: new Date().toISOString() };
  const hour = obs.hourLocal;

  if (obs.userSentVoice) {
    next.voiceMessageCount += 1;
    next.prefersVoice = next.voiceMessageCount >= 2;
    next.lastVoiceAt = next.updatedAt;
    if (typeof obs.userAudioDurationMs === "number" && obs.userAudioDurationMs > 0) {
      const n = next.voiceMessageCount;
      next.avgUserAudioDurationMs =
        (next.avgUserAudioDurationMs * (n - 1) + obs.userAudioDurationMs) / n;
    }
    if (typeof hour === "number" && !next.activeVoiceHours.includes(hour)) {
      next.activeVoiceHours = [...next.activeVoiceHours, hour].slice(-6);
    }
  }

  if (obs.agentSentVoice) {
    next.agentVoiceRepliesSent += 1;
  }

  return next;
}
