import "server-only";

import { runAntiAiFilterPass } from "./anti-ai/anti-ai-filter";
import { maybeSplitAssistantMessage } from "./conversation/message-splitting";
import { maybeHumanMicroPrefix } from "./conversation/micro-behaviors";
import { detectProspectEmotion } from "./emotions/emotion-detector";
import { softenArtificialEnthusiasm, stripCasualOpeners } from "./personality/professional-language";
import { computeHumanResponseDelayMs, computeTypingDelayMs } from "./timing/human-timing-engine";
import { buildBusinessTimeContext } from "./timing/time-context";

import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";

export type HumanResponseEngineInput = {
  rawAssistantText: string;
  microSeed?: string;
  repliesSinceLastEmoji?: number;
  /** Dernier message prospect (émotion + timing). */
  lastUserMessage?: string;
  /** Blacklist métier (profil vendeur). */
  extraPhraseBlacklist?: string[];
  /** Pour délais + fuseau. */
  businessIanaTimezone?: string;
  city?: string;
  country?: string;
  conversationState?: SellerBehaviorConversationState;
};

export type HumanResponseEngineResult = {
  /** Texte prêt pour un canal « une bulle » (lignes courtes, anti-IA appliqué). */
  text: string;
  /** Plan multi-messages si découpe activée. */
  messagePlan: string[];
  meta: {
    emotion: ReturnType<typeof detectProspectEmotion>;
    suggestedDelayBeforeSendMs: number;
    suggestedTypingDurationMs: number;
    antiAiPhraseRemovals: number;
    wasShortened: boolean;
    usedMultiBubblePlan: boolean;
  };
};

function applyEmojiPolicy(text: string, repliesSinceLastEmoji: number): string {
  let out = String(text ?? "").trim();
  const sinceEmoji = repliesSinceLastEmoji ?? 7;
  if (sinceEmoji < 7) {
    out = out.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s{2,}/g, " ").trim();
  } else {
    const emojis = out.match(/[\p{Extended_Pictographic}]/gu) ?? [];
    if (emojis.length > 1) {
      let kept = 0;
      out = out.replace(/[\p{Extended_Pictographic}]/gu, (m) => {
        kept += 1;
        return kept === 1 ? m : "";
      });
      out = out.replace(/\s{2,}/g, " ").trim();
    }
  }
  return out;
}

function enforceShortMessengerShape(text: string): { text: string; wasShortened: boolean } {
  let out = String(text ?? "").trim();
  const origLen = out.length;
  const lines = out.split("\n").map((l) => l.trim()).filter(Boolean);
  out = lines.slice(0, 3).join("\n");
  if (out.length > 420) out = out.slice(0, 420).trim();
  return { text: out, wasShortened: out.length < origLen || lines.length > 3 };
}

/**
 * Pipeline central : humanise une réponse brute du modèle (Seller AI).
 */
export function runHumanResponseEngine(input: HumanResponseEngineInput): HumanResponseEngineResult {
  const userMsg = String(input.lastUserMessage ?? "");
  const emotion = detectProspectEmotion(userMsg);

  const timeCtx = buildBusinessTimeContext({
    businessIanaTimezone: input.businessIanaTimezone,
    city: input.city,
    country: input.country,
  });

  const anti = runAntiAiFilterPass(input.rawAssistantText, input.extraPhraseBlacklist);
  let out = anti.text;

  out = stripCasualOpeners(out);
  out = softenArtificialEnthusiasm(out);

  const shortPack = enforceShortMessengerShape(out);
  out = shortPack.text;

  out = applyEmojiPolicy(out, input.repliesSinceLastEmoji ?? 7);
  out = maybeHumanMicroPrefix(out, input.microSeed ?? out);

  const plan = maybeSplitAssistantMessage(out, input.microSeed ?? out);
  const usedMulti = plan.length > 1;
  const text = usedMulti ? plan.join("\n\n") : out;

  const delay = computeHumanResponseDelayMs({
    prospectMessage: userMsg,
    emotion,
    daySlot: timeCtx.daySlot,
    replyCharEstimate: text.length,
  });
  const typing = computeTypingDelayMs(text, emotion);

  return {
    text,
    messagePlan: plan,
    meta: {
      emotion,
      suggestedDelayBeforeSendMs: delay,
      suggestedTypingDurationMs: typing,
      antiAiPhraseRemovals: anti.removedPhraseHits,
      wasShortened: shortPack.wasShortened,
      usedMultiBubblePlan: usedMulti,
    },
  };
}
