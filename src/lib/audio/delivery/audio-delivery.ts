import "server-only";

import type { VoiceResponsePlan } from "../voice/voice-response-engine";

/** Prépare le payload client pour affichage WhatsApp-like. */
export function formatAudioDeliveryPayload(plan: VoiceResponsePlan) {
  if (plan.mode !== "voice" || !plan.audio) {
    return {
      reply: plan.text,
      delivery: "text" as const,
    };
  }

  const dataUrl = `data:${plan.audio.mimeType};base64,${plan.audio.audioBase64}`;

  return {
    reply: plan.text,
    delivery: "voice" as const,
    audio: {
      url: dataUrl,
      durationMs: plan.audio.durationMs,
      mimeType: plan.audio.mimeType,
    },
    timing: plan.timing,
    decisionReasons: plan.decisionReasons,
  };
}
