import "server-only";

import { detectProspectEmotion } from "@/lib/agents/human-behavior/emotions/emotion-detector";
import { detectConversationLanguage } from "@/lib/ai/language-detection";

export type TranscriptionResult = {
  text: string;
  language: "fr" | "en" | "es";
  emotion: ReturnType<typeof detectProspectEmotion>;
  urgency: "low" | "medium" | "high";
  hesitation: boolean;
  toneHint: string;
  durationMs?: number;
};

function detectHesitation(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(euh|hum|ben|je\s+sais\s+pas|hésite|peut[- ]être|j'sais\s+pas)\b/i.test(t) || t.length < 12;
}

function detectUrgency(text: string): "low" | "medium" | "high" {
  const t = text.toLowerCase();
  if (/\b(urgent|vite|maintenant|tout\s+de\s+suite|asap)\b/i.test(t)) return "high";
  if (/\?/.test(t) && t.length < 80) return "medium";
  return "low";
}

function toneHintFromEmotion(emotion: ReturnType<typeof detectProspectEmotion>): string {
  if (emotion === "frustration" || emotion === "anger") return "tendu";
  if (emotion === "hesitation" || emotion === "confusion") return "hésitant";
  if (emotion === "purchase_interest" || emotion === "enthusiasm") return "motivé";
  if (emotion === "impatience") return "pressé";
  return "neutre";
}

/** OpenAI Whisper — nécessite OPENAI_API_KEY (fallback texte si absent). */
export async function transcribeAudioBuffer(args: {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
  languageHint?: "fr" | "en" | "es";
}): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AUDIO_TRANSCRIPTION_UNAVAILABLE");
  }

  const form = new FormData();
  const blob = new Blob([new Uint8Array(args.buffer)], { type: args.mimeType });
  form.append("file", blob, args.filename ?? "voice.webm");
  form.append("model", "whisper-1");
  if (args.languageHint) form.append("language", args.languageHint === "en" ? "en" : args.languageHint === "es" ? "es" : "fr");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const js = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(String((js as { error?: { message?: string } })?.error?.message ?? "transcription_failed"));
  }

  const text = String((js as { text?: string }).text ?? "").trim();
  const detected = detectConversationLanguage({ message: text, previous: args.languageHint });
  const language: TranscriptionResult["language"] =
    detected === "en" ? "en" : detected === "es" ? "es" : "fr";
  const emotion = detectProspectEmotion(text);
  const hesitation = detectHesitation(text);
  const urgency = detectUrgency(text);

  return {
    text,
    language,
    emotion,
    urgency,
    hesitation,
    toneHint: toneHintFromEmotion(emotion),
  };
}
