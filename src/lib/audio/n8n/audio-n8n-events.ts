import "server-only";

export type AudioN8nEventKind =
  | "audio_followup"
  | "audio_order_confirmation"
  | "audio_payment_reminder"
  | "audio_warm_checkin";

export type AudioN8nPayload = {
  event: AudioN8nEventKind;
  timestamp: string;
  prospect: {
    name?: string;
    phone?: string;
    sessionId: string;
  };
  agent: {
    id: string;
    personaKey?: string;
    displayName?: string;
  };
  audio: {
    scriptText: string;
    estimatedDurationMs?: number;
    voiceProfileId?: string;
  };
  metadata?: Record<string, string | number | boolean>;
};

export function buildAudioN8nPayload(args: Omit<AudioN8nPayload, "timestamp">): AudioN8nPayload {
  return {
    ...args,
    timestamp: new Date().toISOString(),
  };
}
