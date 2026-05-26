/**
 * Mémoire audio prospect — préférences vocales (explicable).
 */

export type AudioMemory = {
  prefersVoice: boolean;
  voiceMessageCount: number;
  avgUserAudioDurationMs: number;
  lastVoiceAt?: string;
  activeVoiceHours: number[];
  preferredTone?: "warm" | "calm" | "dynamic";
  agentVoiceRepliesSent: number;
  updatedAt: string;
};

export const EMPTY_AUDIO_MEMORY = (): AudioMemory => ({
  prefersVoice: false,
  voiceMessageCount: 0,
  avgUserAudioDurationMs: 0,
  activeVoiceHours: [],
  agentVoiceRepliesSent: 0,
  updatedAt: new Date().toISOString(),
});
