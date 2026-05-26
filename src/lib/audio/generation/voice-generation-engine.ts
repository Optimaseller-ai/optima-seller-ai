import "server-only";

import { resolveAgentVoicePersonality } from "../personality/voice-personalities";
import { sanitizeTextForVoice } from "../safety/audio-safety";

export type VoiceSynthesisResult = {
  audioBase64: string;
  mimeType: string;
  durationEstimateMs: number;
  voiceId: string;
};

function estimateDurationMs(text: string, speed: number): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const wpm = 145 * speed;
  return Math.min(90_000, Math.max(1500, Math.round((words / wpm) * 60_000)));
}

/** Synthèse vocale OpenAI TTS — sobre, pas robot US marketing. */
export async function synthesizeVoiceReply(args: {
  text: string;
  personaKey?: string | null;
  gender?: "male" | "female";
}): Promise<VoiceSynthesisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const spoken = sanitizeTextForVoice(args.text);
  if (spoken.length < 4) return null;

  const personality = resolveAgentVoicePersonality({
    personaKey: args.personaKey,
    gender: args.gender,
  });
  const voice = personality.profile.ttsVoice;
  const speed = personality.profile.speed;

  const resp = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: spoken,
      voice,
      speed,
      response_format: "mp3",
    }),
  });

  if (!resp.ok) return null;

  const buf = Buffer.from(await resp.arrayBuffer());
  const audioBase64 = buf.toString("base64");

  return {
    audioBase64,
    mimeType: "audio/mpeg",
    durationEstimateMs: estimateDurationMs(spoken, speed),
    voiceId: voice,
  };
}
