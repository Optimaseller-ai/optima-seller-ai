"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Reply, Smile, Trash2 } from "lucide-react";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { ChatClearModal } from "./chat-clear-modal";
import { ChatEmptyState } from "./chat-empty-state";
import {
  applyConversationUiClear,
  archiveMessagesFromUi,
  isConversationUiCleared,
  patchConversationStateForApi,
} from "@/lib/chat/conversation-ui-state";
import { ChatInsightsPanel } from "./chat-insights-panel";
import { ChatSidebar } from "./chat-sidebar";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import { TypingBubble } from "./typing-bubble";
import { ChatSeenIndicator } from "./chat-seen-indicator";
import {
  COMMERCIAL_AGENTS,
  getCommercialAgentById,
  pickRandomCommercialAgent,
  type CommercialAgentDef,
  type CommercialAgentPublic,
} from "@/lib/chat/commercial-agents";
import type { ProspectTone, SellerBehaviorConversationState } from "@/lib/chat/seller-behavior-types";
import { detectConversationLanguage } from "@/lib/ai/language-detection";
import { clientEmotionalPauseBoost, inferConversationEmotionalTemperature } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import { computeResponseWeight, responseWeightThinkBoost } from "@/lib/agents/human-behavior/response-weight-system";
import {
  microMoodVariation,
  socialDayPhaseFromLocalHour,
  socialEnergyThinkMultiplier,
} from "@/lib/agents/human-behavior/social-energy-engine";
import { businessRhythmBandFromJsDate, businessRhythmDelayMultiplier } from "@/lib/agents/human-behavior/business-rhythm";
import { microSilenceExtraReactionDelayMs, microSilenceReduceOptionalInterludes } from "@/lib/chat/micro-silence-system";
import { isBareAcknowledgmentMessage } from "@/lib/chat/smart-read-simulation";
import { buildHumanTimingPlan } from "@/lib/chat/human-timing-plan";
import { computeHumanTypingDurationMs, computeMultiBubblePauseMs, nextTypingRhythmBeat, shouldApplyTypingRhythmBeat } from "@/lib/chat/human-typing-rhythm";
import { humanTypingPauseMs, shouldHumanTypingInterrupt, shouldSecondaryTypingInterrupt } from "@/lib/chat/human-typing-pattern";
import { pickPresenceMicroLine } from "@/lib/agents/human-behavior/presence-engine";
import { pickLifePresenceMicroLine } from "@/lib/agents/human-behavior/life-presence-engine";
import {
  attentionFluctuationThinkMultiplier,
  inferAttentionFluctuationMode,
} from "@/lib/chat/attention-fluctuation";
import { silenceIntelligenceExtraWaitMs } from "@/lib/chat/silence-intelligence";
import { silencePsychologyExtraWaitMs } from "@/lib/agents/human-behavior/silence-psychology";
import { detectSocialSignal, isSocialSignalKind, sanitizeHoldReply } from "@/lib/agents/social/client";
import {
  digitalBodyLanguageV2ReadBoost,
  digitalBodyLanguageV2ThinkMultiplier,
  getHesitationBeat,
  shouldInjectHesitationBeat,
} from "@/lib/agents/human-behavior/digital-body-language-v2";
import { inferBehavioralPresence, inferNaturalAttentionBand, naturalAttentionThinkMultiplier } from "@/lib/agents/human-behavior/behavior-engine";
import {
  businessPressureThinkMultiplier,
  inferBusinessPressureLevel,
} from "@/lib/agents/human-behavior/humanized-business-pressure";
import { getThinkingInterruptionScript, shouldInjectThinkingInterruption } from "@/lib/chat/thinking-simulation";
import { attentionShiftThinkMultiplier, inferAttentionShiftMode } from "@/lib/chat/attention-shift-engine";
import { getResponseBreathingScript, shouldInjectResponseBreathing } from "@/lib/chat/response-breathing";
import { digitalBodyLanguagePacingBoost } from "@/lib/agents/human-behavior/digital-body-language";
import { getBackgroundActivityScript, shouldInjectBackgroundActivity } from "@/lib/chat/background-activity";
import { humanConversationBreathingExtraMs } from "@/lib/chat/human-conversation-breathing";
import { getConversationBreakScript, shouldInjectConversationBreak } from "@/lib/chat/conversation-breaks";
import { readPreChatProfile } from "@/lib/prospect/pre-chat/storage";
import { mergeLeadIntoConversationState } from "@/lib/prospect/pre-chat/agent-awareness";
import { detectResponsePrimaryIntent } from "@/lib/agents/human-behavior/coherence/response-intent";
import { orchestrateMessageBubbles } from "@/lib/agents/human-behavior/coherence/message-bubble-orchestrator";
import {
  collapseRedundantBubbleSplit,
  dedupeAssistantMessageBubbles,
  sanitizeAssistantReplyText,
} from "@/lib/agents/human-behavior/coherence/message-deduplication-guard";
import { messageRequiresMainReplyPipeline } from "@/lib/chat/pipeline/central-reply-manager";
import {
  dedupeThreadMessages,
} from "@/lib/chat/dedupe-thread-messages";
import { smartAutoScroll } from "@/lib/chat-ui/smart-auto-scroll";
import { HumanPlaybackScheduler } from "@/lib/chat-ui/human-playback-scheduler";
import {
  type HumanDeliverySocketEvent,
  rehydrateDeliveryState,
  useHumanDeliveryStore,
} from "@/lib/chat-ui/use-human-delivery-store";

type StoredMessage = {
  /** Stable React key — persisted to avoid hash collisions on reload/sync. */
  id?: string;
  role: "user" | "assistant";
  content: string;
  ts: string;
  kind?: "text" | "image" | "audio";
  image_data_url?: string;
  audio_data_url?: string;
  audio_duration_ms?: number;
  voice_transcript?: string;
  reply_to_id?: string;
  reactions?: Record<string, number>;
  delivered_at?: string;
  read_at?: string;
};
type UiMessage = StoredMessage & {
  id: string;
  typing?: boolean;
  animateIn?: "left" | "right";
  status?: "sending" | "sent" | "delivered" | "read";
  /** ID de la requête /api/chat/send — ignore les réponses hors tour. */
  request_id?: string;
  /** Micro-bulle client (interlude) — retirée avant la réponse finale du même tour. */
  candidate?: boolean;
};

type HumanAgentPersonality = "chaleureux" | "professionnel" | "dynamique";
type SalesStyle = "conseiller" | "closer" | "premium";
type HumanAgentProfile = {
  id: string;
  name: string;
  gender: "f" | "m";
  avatar: string; // public path or remote url
  accent: { from: string; to: string };
  personality: HumanAgentPersonality;
  salesStyle: SalesStyle;
  role?: string;
  statusHint?: string;
};

type StoredChatSession = {
  messages: StoredMessage[];
  agent_name: string;
  agent_personality: HumanAgentPersonality;
  sales_style: SalesStyle;
  created_at: number;
  /** Soft delete UI — mémoire agent conservée côté conversation_state. */
  ui_messages_cleared_at?: number;
  ui_hidden_messages?: StoredMessage[];
  conversation_ui_state?: import("@/lib/chat/conversation-ui-state").ConversationUiState;
  conversation_state?: SellerBehaviorConversationState & {
    agent_profile?: HumanAgentProfile;
  };
};

type ConversationPreview = {
  slug: string;
  businessName: string;
  preview: string;
  unread: number;
  avatarUrl?: string;
  lastTs: number;
};

const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 50;

function clamp(min: number, value: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function formatDayLabel(ts: string, now = new Date()) {
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOf(d) - startOf(now)) / (24 * 60 * 60 * 1000));
    if (dayDiff === 0) return "Aujourd'hui";
    if (dayDiff === -1) return "Hier";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  } catch {
    return "";
  }
}

function diffMs(aIso: string, bIso: string) {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b);
}

// computeReplyDelayMs removed: timing is handled by read/think + typingDuration.

function getOrCreateSessionId() {
  const key = "optima_chat_session_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing && existing.length > 8) return existing;
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function commercialDefToHumanProfile(a: CommercialAgentDef): HumanAgentProfile {
  return {
    id: a.id,
    name: a.name,
    gender: a.gender === "female" ? "f" : "m",
    avatar: a.avatar,
    accent: a.accent,
    personality: a.personality,
    salesStyle: a.salesStyle,
    role: a.role,
    statusHint: a.statusTagline,
  };
}

function generateHumanAgentProfile(): HumanAgentProfile {
  return commercialDefToHumanProfile(pickRandomCommercialAgent());
}

function personaToHumanProfile(persona: CommercialAgentPublic): HumanAgentProfile {
  return {
    id: persona.id,
    name: persona.name,
    gender: persona.gender === "female" ? "f" : "m",
    avatar: persona.avatar,
    accent: persona.accent,
    personality: persona.personality,
    salesStyle: persona.salesStyle,
    role: persona.role,
    statusHint: persona.statusTagline,
  };
}

function storageKeyForSlug(slug: string) {
  return `chat_session_${slug}`;
}

function isExpired(createdAt: number) {
  return Date.now() - createdAt > FIVE_DAYS;
}

function hourBucket(h: number) {
  if (h >= 6 && h <= 11) return "morning";
  if (h >= 12 && h <= 17) return "afternoon";
  if (h >= 18 && h <= 22) return "evening";
  return "night";
}

function detectRushedUserMessage(userMessage: string) {
  const msg = String(userMessage ?? "").trim();
  const m = msg.toLowerCase();
  if (msg.length <= 3) return true;
  if (msg.length <= 10 && !/[?.!]/.test(msg)) return true;
  if (/^(prix|prx|combien|dispo|stock|taille|couleur|adresse|où|ou|livraison|payer|paiement)\s*\??$/i.test(m)) return true;
  if (/\b(vite|urgent|tt suite|tout de suite|maintenant)\b/i.test(m)) return true;
  return false;
}

function detectTalkativeUserMessage(userMessage: string) {
  const msg = String(userMessage ?? "").trim();
  const wc = msg.split(/\s+/).filter(Boolean).length;
  return msg.length >= 170 || wc >= 30;
}

type ChatUiLang = "fr" | "en" | "es";

function pickClientHoldReply(lang: ChatUiLang, userMessage?: string): string {
  if (userMessage && isSocialSignalKind(detectSocialSignal(userMessage))) {
    if (lang === "en") return "Hi — I'm here for you.";
    if (lang === "es") return "Hola — estoy aquí.";
    return "Bonjour — je suis là pour vous.";
  }
  const fr = ["Je reviens vers vous.", "D'accord, je note.", "Un instant — je vous dis ça."];
  const en = ["I'll get back to you.", "Got it.", "One moment — I'll tell you."];
  const es = ["Le confirmo en seguida.", "De acuerdo.", "Un momento — le digo."];
  const xs = lang === "en" ? en : lang === "es" ? es : fr;
  return xs[Math.floor(Math.random() * xs.length)]!;
}

function pickServiceInterlude(args: { lang: ChatUiLang; style: "direct" | "reassuring"; seed: string }) {
  const lifeMicro = pickLifePresenceMicroLine(args.lang, args.seed);
  if (lifeMicro) return lifeMicro;
  const presenceMicro = pickPresenceMicroLine(args.lang, args.seed);
  if (presenceMicro) return presenceMicro;
  if (args.lang === "en") {
    const direct = ["One moment.", "Let me check.", "Alright, checking now."];
    const reassuring = ["One moment please.", "I’m checking that for you.", "Thanks for your patience."];
    const presence = ["I’m at the warehouse checking.", "I’m confirming with stock.", "Looking up another SKU for you."];
    const xs = args.style === "reassuring" ? reassuring : direct;
    if (Math.random() < 0.26) return presence[Math.floor(Math.random() * presence.length)]!;
    return xs[Math.floor(Math.random() * xs.length)]!;
  }
  if (args.lang === "es") {
    const direct = ["Un momento.", "Estoy mirando eso.", "Vale, reviso."];
    const reassuring = ["Un momento por favor.", "Estoy verificando eso para usted.", "Gracias por su paciencia."];
    const presence = ["Estoy en el almacén revisando.", "Confirmo con stock.", "Miro otra referencia."];
    const xs = args.style === "reassuring" ? reassuring : direct;
    if (Math.random() < 0.26) return presence[Math.floor(Math.random() * presence.length)]!;
    return xs[Math.floor(Math.random() * xs.length)]!;
  }
  const direct = ["Un instant.", "D'accord.", "Je note."];
  const reassuring = ["Un instant, je vous réponds.", "Je regarde cela avec attention.", "Merci pour votre patience."];
  const presence = ["Je suis au dépôt, je regarde ça.", "Je confirme avec le stock.", "Je regarde sur une autre réf."];
  const xs = args.style === "reassuring" ? reassuring : direct;
  if (Math.random() < 0.28) return presence[Math.floor(Math.random() * presence.length)]!;
  return xs[Math.floor(Math.random() * xs.length)]!;
}

function uiLangFromConversationState(state: unknown): ChatUiLang {
  const l = (state && typeof state === "object" ? (state as { language?: string }).language : undefined) ?? "fr";
  if (l === "en" || l === "es") return l;
  return "fr";
}

function computeThinkDelayMs(
  userMessage: string,
  opts?: { profileTone?: ProspectTone; fatigue01?: number; personaKey?: string | null; turnCount?: number },
) {
  const m = String(userMessage ?? "").toLowerCase();
  const weight = computeResponseWeight(userMessage);
  const talkative = detectTalkativeUserMessage(userMessage);
  const temp = inferConversationEmotionalTemperature(userMessage);
  const prospectCold = temp === "froid";
  const complex =
    m.length > 80 ||
    /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(m);
  const veryShort = m.trim().length <= 14;
  const base = complex ? 5200 + Math.round(Math.random() * 6800) : 1600 + Math.round(Math.random() * 2800);
  const shortCut = veryShort ? 400 + Math.round(Math.random() * 500) : 0;
  const hesitant = opts?.profileTone === "hesitant" ? 1200 + Math.round(Math.random() * 3200) : 0;
  const h = new Date().getHours();
  const phase = socialDayPhaseFromLocalHour(h);
  const mood = microMoodVariation(String(userMessage ?? "") + phase);
  const socialMul = socialEnergyThinkMultiplier(phase) * mood.paceMultiplier;
  const lateNight = h >= 23 || h < 5;
  const emotional =
    /\b(désol|pardon|stress|énerv|énervé|frustr|inquiet|peur|hésit|hésite|pas\s+sûr|pas\s+sure)\b/i.test(m);
  const reflective = emotional ? 900 + Math.round(Math.random() * 2400) : 0;
  let out = clamp(1200, base + hesitant + reflective - shortCut, complex ? 20_000 : 7200);
  if (lateNight) out = Math.round(out * 1.14);
  out = Math.round(out * socialMul);
  out = Math.round(out * responseWeightThinkBoost(weight.tier));
  if (talkative) out = Math.round(out * 1.07);
  if (prospectCold) out = Math.round(out * 0.9);
  out = Math.round(out * businessRhythmDelayMultiplier(businessRhythmBandFromJsDate(new Date())));
  const attnMode = inferAttentionFluctuationMode(String(userMessage ?? ""), String(userMessage ?? "") + "think");
  out = Math.round(out * attentionFluctuationThinkMultiplier(attnMode));
  const shiftMode = inferAttentionShiftMode(String(userMessage ?? ""), String(userMessage ?? "") + "shift");
  out = Math.round(out * attentionShiftThinkMultiplier(shiftMode));
  const presence = inferBehavioralPresence({
    personaKey: opts?.personaKey,
    fatigue01: opts?.fatigue01,
    prospectTone: opts?.profileTone,
    turnCount: opts?.turnCount,
  });
  out = Math.round(out * digitalBodyLanguageV2ThinkMultiplier(opts?.fatigue01 ?? 0, presence.energy));
  const attnBand = inferNaturalAttentionBand({
    turnCount: opts?.turnCount,
    fatigue01: opts?.fatigue01,
    seed: String(userMessage ?? "") + String(opts?.turnCount ?? 0),
  });
  out = Math.round(out * naturalAttentionThinkMultiplier(attnBand));
  const pressure = inferBusinessPressureLevel({
    rhythmBand: businessRhythmBandFromJsDate(new Date()),
    turnCount: opts?.turnCount,
    hour: h,
  });
  out = Math.round(out * businessPressureThinkMultiplier(pressure));
  return out;
}

function computeTypingDurationMs(args: {
  reply: string;
  mode: "short" | "sales" | "long";
  fatigue01: number;
  rushed: boolean;
  profileTone?: ProspectTone;
}) {
  const len = String(args.reply ?? "").trim().length;
  const h = new Date().getHours();
  const bucket = hourBucket(h);
  const lateNightSlow = h >= 23 ? 700 + Math.round(Math.random() * 1100) : 0;
  const nightSlow =
    (bucket === "night" ? 900 + Math.round(Math.random() * 1400) : bucket === "evening" ? 400 + Math.round(Math.random() * 700) : 0) + lateNightSlow;
  let base: number;
  if (len < 90) base = 2800 + Math.round(Math.random() * 4200);
  else if (len < 240) base = 3600 + Math.round(Math.random() * 4000);
  else base = 4800 + Math.round(Math.random() * 3800);

  if (args.rushed) base = Math.max(2600, Math.round(base * 0.82));
  const f = clamp(0, args.fatigue01, 1);
  const fatigueLag = Math.round(90 * f);
  const jitter = Math.round(Math.random() * 400);
  const hesitant = args.profileTone === "hesitant" ? 500 + Math.round(Math.random() * 900) : 0;
  const fatigueShrink = 1 - 0.12 * f;
  return clamp(2600, Math.round((base + fatigueLag + jitter + nightSlow + hesitant) * fatigueShrink), 14_000);
}

function randBetween(min: number, max: number) {
  return min + Math.round(Math.random() * (max - min));
}

/** Garde l’indicateur « humain » au moins 8–15 s avant un message de secours. */
async function ensureMinTypingPauseBeforeFallback(elapsedTypingMs: number) {
  const target = randBetween(8000, 15000);
  const wait = Math.max(0, target - elapsedTypingMs);
  if (wait > 0) await sleep(wait);
}

function loadSession(slug: string): StoredChatSession | null {
  try {
    const key = storageKeyForSlug(slug);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const createdAt = typeof parsed?.created_at === "number" ? parsed.created_at : 0;
    if (!createdAt || isExpired(createdAt)) {
      window.localStorage.removeItem(key);
      return null;
    }

    const messages = Array.isArray(parsed?.messages) ? (parsed.messages as any[]) : [];
    const cleanedMessages: StoredMessage[] = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && typeof m.ts === "string")
      .slice(-MAX_STORED_MESSAGES)
      .map((m, index) => ({
        id: typeof m.id === "string" && m.id.trim() ? String(m.id).trim() : legacyStableMessageId({ role: m.role, content: String(m.content), ts: String(m.ts) }, index),
        role: m.role,
        content: String(m.content),
        ts: String(m.ts),
        kind:
          m.kind === "image" ? ("image" as const) : m.kind === "audio" ? ("audio" as const) : undefined,
        image_data_url: typeof m.image_data_url === "string" ? m.image_data_url : undefined,
        audio_data_url: typeof m.audio_data_url === "string" ? m.audio_data_url : undefined,
        audio_duration_ms: typeof m.audio_duration_ms === "number" ? m.audio_duration_ms : undefined,
        voice_transcript: typeof m.voice_transcript === "string" ? m.voice_transcript : undefined,
        reply_to_id: typeof m.reply_to_id === "string" ? m.reply_to_id : undefined,
        reactions: m.reactions && typeof m.reactions === "object" ? (m.reactions as Record<string, number>) : undefined,
        delivered_at: typeof m.delivered_at === "string" ? m.delivered_at : undefined,
        read_at: typeof m.read_at === "string" ? m.read_at : undefined,
      }));

    const agentName = typeof parsed?.agent_name === "string" ? parsed.agent_name.trim() : "";
    const agentPersonality: HumanAgentPersonality =
      parsed?.agent_personality === "chaleureux" || parsed?.agent_personality === "professionnel" || parsed?.agent_personality === "dynamique"
        ? parsed.agent_personality
        : "chaleureux";
    const salesStyle: SalesStyle =
      parsed?.sales_style === "conseiller" || parsed?.sales_style === "closer" || parsed?.sales_style === "premium"
        ? parsed.sales_style
        : "conseiller";

    if (!agentName) return null;

    return {
      messages: dedupeThreadMessages(cleanedMessages) as StoredMessage[],
      agent_name: agentName,
      agent_personality: agentPersonality,
      sales_style: salesStyle,
      created_at: createdAt,
      ui_messages_cleared_at:
        typeof parsed?.ui_messages_cleared_at === "number" ? parsed.ui_messages_cleared_at : undefined,
      ui_hidden_messages: Array.isArray(parsed?.ui_hidden_messages) ? (parsed.ui_hidden_messages as StoredMessage[]) : undefined,
      conversation_ui_state:
        typeof parsed?.conversation_ui_state === "object" && parsed.conversation_ui_state
          ? parsed.conversation_ui_state
          : undefined,
      conversation_state: typeof parsed?.conversation_state === "object" && parsed.conversation_state ? parsed.conversation_state : undefined,
    };
  } catch {
    return null;
  }
}

function saveSession(slug: string, session: StoredChatSession) {
  try {
    const key = storageKeyForSlug(slug);
    const next: StoredChatSession = { ...session, messages: session.messages.slice(-MAX_STORED_MESSAGES) };
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function createFreshSession(slug: string, persona?: CommercialAgentPublic | null): StoredChatSession {
  const profile = persona ? personaToHumanProfile(persona) : generateHumanAgentProfile();
  return {
    messages: [],
    agent_name: profile.name,
    agent_personality: profile.personality,
    sales_style: profile.salesStyle,
    created_at: Date.now(),
    conversation_state: {
      language: "fr",
      agent_profile: profile,
      preferences: { blacklist: [] },
      mood: "",
      memory: [],
      tone_mode: "conversation_naturelle",
      stats: { turn_count: 0, fatigue: 0, last_active_at: Date.now() },
    },
  };
}

function applyPreChatLeadToSession(slug: string, session: StoredChatSession): StoredChatSession {
  const lead = readPreChatProfile(slug);
  if (!lead?.name?.trim()) return session;
  if (session.conversation_state?.prospectLead?.name === lead.name) return session;
  const merged: StoredChatSession = {
    ...session,
    conversation_state: mergeLeadIntoConversationState(session.conversation_state, lead) as StoredChatSession["conversation_state"],
  };
  saveSession(slug, merged);
  return merged;
}

function getOrCreateSession(slug: string, persona?: CommercialAgentPublic | null): StoredChatSession {
  const existing = loadSession(slug);
  if (existing) {
    const hasConversation =
      (existing.messages?.length ?? 0) > 0 ||
      Boolean((existing.conversation_state as { intro_done?: boolean } | undefined)?.intro_done);
    if (persona && existing.conversation_state?.agent_profile?.id !== persona.id) {
      if (hasConversation) {
        return existing;
      }
      const profile = personaToHumanProfile(persona);
      const merged: StoredChatSession = {
        ...existing,
        agent_name: persona.name,
        agent_personality: persona.personality,
        sales_style: persona.salesStyle,
        conversation_state: {
          ...(existing.conversation_state ?? {}),
          agent_profile: profile,
        },
      };
      saveSession(slug, merged);
      return applyPreChatLeadToSession(slug, merged);
    }
    return applyPreChatLeadToSession(slug, existing);
  }
  const next = createFreshSession(slug, persona);
  saveSession(slug, next);
  return applyPreChatLeadToSession(slug, next);
}

function newMessageId(): string {
  return crypto.randomUUID();
}

/** Legacy fallback when older sessions have no persisted id (index disambiguates collisions). */
function legacyStableMessageId(m: StoredMessage, index: number): string {
  let h = 0;
  const c = String(m.content ?? "");
  const s = `${m.ts}\0${m.role}\0${c.length}\0${c.slice(0, 4000)}\0${index}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `m_${(h >>> 0).toString(36)}_${c.length}_${index}`;
}

function toUiMessages(args: { messages: StoredMessage[]; session?: StoredChatSession | null }): UiMessage[] {
  const seen = new Set<string>();
  return args.messages.map((m, index) => {
    let id = String(m.id ?? "").trim() || legacyStableMessageId(m, index);
    while (seen.has(id)) {
      id = `${id}_${index}`;
    }
    seen.add(id);
    return { ...m, id };
  });
}

function initials(name: string) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "S";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function rosterAvatarFallbackForName(displayName: string) {
  const key = String(displayName ?? "").trim().toLowerCase();
  const direct = COMMERCIAL_AGENTS.find((a) => a.name.toLowerCase() === key);
  if (direct) return direct.avatar;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return COMMERCIAL_AGENTS[Math.abs(hash) % COMMERCIAL_AGENTS.length]!.avatar;
}

function triggerMobileHaptic(pattern: number | number[]) {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (!window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches) return;
    (navigator as any).vibrate?.(pattern);
  } catch {
    // ignore haptics on unsupported devices
  }
}

function formatRelativeLastActive(lastActiveAt: number, now = Date.now()) {
  const delta = Math.max(0, now - lastActiveAt);
  if (delta < 15_000) return "Actif il y a quelques secondes";
  if (delta < 60_000) return "Actif il y a moins d’une minute";
  const minutes = Math.round(delta / 60_000);
  if (minutes <= 2) return "Actif il y a 2 minutes";
  if (minutes < 60) return `Actif il y a ${minutes} minutes`;
  const hours = Math.round(delta / 3_600_000);
  if (hours <= 1) return "Actif il y a 1 heure";
  if (hours < 6) return `Actif il y a ${hours} heures`;
  return "Actif aujourd’hui";
}

function sanitizeUiLabel(value: string) {
  return String(value ?? "")
    .replace(/\b(ia|ai|assistant|bot|automatique|generated?|généré)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function getOfficeHoursLabel(now = new Date()) {
  const h = now.getHours();
  const isBusiness = h >= 8 && h <= 22;
  if (isBusiness) return { status: "En ligne", hint: "Répond rapidement" };
  if (h >= 23 || h <= 5) return { status: "Hors ligne", hint: "Actif en matinée" };
  return { status: "En ligne", hint: "Réponse sous peu" };
}

function contextualStatus(args: { lastUserMessage: string; officeStatus: "En ligne" | "Hors ligne" }) {
  const m = String(args.lastUserMessage ?? "").toLowerCase();
  if (args.officeStatus === "Hors ligne") return "Répond généralement le matin";
  if (!m) return "En conversation";
  if (/\b(prix|combien|tarif)\b/i.test(m)) return "Prépare un devis";
  if (/\b(dispo|disponible|stock)\b/i.test(m)) return "Vérifie la disponibilité";
  if (/\b(taille|size)\b/i.test(m)) return "Vérifie les tailles";
  if (/\b(couleur|coloris)\b/i.test(m)) return "Vérifie les coloris";
  if (/\b(livraison|adresse|où|ou)\b/i.test(m)) return "Prépare les options de livraison";
  if (/\b(payer|paiement|payment|checkout)\b/i.test(m)) return "Vous accompagne au paiement";
  if (/\b(urgent|vite|maintenant)\b/i.test(m)) return "Revient vers vous";
  return "En conversation";
}

export default function ChatClient({
  slug,
  agentName,
  lockedPersona = null,
}: {
  slug: string;
  agentName: string;
  lockedPersona?: CommercialAgentPublic | null;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<UiMessage | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string>("");
  const [recordingVoice, setRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStartedAtRef = useRef(0);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const [sending, setSending] = useState(false);
  const [readReceiptMessageId, setReadReceiptMessageId] = useState<string | null>(null);
  type AgentPresencePhase = "default" | "online" | "seen" | "thinking" | "writing";
  const [agentPresencePhase, setAgentPresencePhase] = useState<AgentPresencePhase>("default");
  const [unseenCount, setUnseenCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [avatarOk, setAvatarOk] = useState(true);
  const [imageSendProgress, setImageSendProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [idlePresence, setIdlePresence] = useState<string>("En ligne");
  const [backgroundMode, setBackgroundMode] = useState<"mesh" | "blur" | "noise" | "paper">("noise");
  const [imageZoomUrl, setImageZoomUrl] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearingUi, setIsClearingUi] = useState(false);
  const lastAssistantCountRef = useRef(0);
  const [conversationPreviews, setConversationPreviews] = useState<ConversationPreview[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [soundsOn, setSoundsOn] = useState(false);
  const deliveryState = useHumanDeliveryStore();
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const playbackSchedulerRef = useRef<HumanPlaybackScheduler | null>(null);
  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (!el) return;
    const top = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTo({ top, behavior });
  }, []);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inFlightRef = useRef(false);
  const sendAbortRef = useRef<AbortController | null>(null);
  const activeSendRef = useRef<{ requestId: string; userMessage: string } | null>(null);
  /** Bloque /api/chat/sync juste après un envoi (évite doublon client ts ≠ serveur ts). */
  const syncSuppressUntilRef = useRef(0);
  const lastSendFingerprintRef = useRef<{ text: string; at: number } | null>(null);
  const typingStartedAtRef = useRef<number | null>(null);
  const readTimerFiredRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);
  const [localSessionTick, setLocalSessionTick] = useState(0);

  const sessionId = useMemo(() => (typeof window === "undefined" ? "" : getOrCreateSessionId()), []);
  const storedSession = useMemo(
    () => (typeof window === "undefined" ? null : getOrCreateSession(slug, lockedPersona ?? null)),
    [slug, lockedPersona?.id, localSessionTick],
  );
  const storedSessionRef = useRef(storedSession);
  useEffect(() => {
    storedSessionRef.current = storedSession;
  }, [storedSession]);
  const messagesRef = useRef<UiMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    rehydrateDeliveryState();
  }, []);
  const appendAssistantFragment = useCallback((content: string) => {
    const clean = String(content ?? "").trim();
    if (!clean) return;
    const assistantId = newMessageId();
    setMessages((prev) => {
      const next = prev
        .filter((m) => !m.typing)
        .concat({
          id: assistantId,
          role: "assistant",
          content: clean,
          ts: new Date().toISOString(),
          animateIn: "left" as const,
        });
      persistFromUi(next);
      return next;
    });
    const autoScrolled = smartAutoScroll({ container: listRef.current });
    if (!autoScrolled) setUnseenCount((n) => n + 1);
  }, []);
  useEffect(() => {
    if (playbackSchedulerRef.current) return;
    playbackSchedulerRef.current = new HumanPlaybackScheduler({
      onSeen: () => setAgentPresencePhase("seen"),
      onTypingStart: () => setAgentPresencePhase("writing"),
      onTypingStop: () => setAgentPresencePhase("online"),
      onFragment: (event) => appendAssistantFragment(String(event.content ?? "")),
      onCancelled: () => setAgentPresencePhase("default"),
      onCompleted: () => setAgentPresencePhase("default"),
    });
  }, [appendAssistantFragment]);
  useEffect(() => {
    const scheduler = playbackSchedulerRef.current;
    if (!scheduler) return;
    const onVisibility = () => {
      if (document.hidden) scheduler.pausePlayback();
      else scheduler.resumePlayback();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      scheduler.cancelPlayback({ event: "delivery_cancelled" });
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSocketEvent = (ev: Event) => {
      const custom = ev as CustomEvent<HumanDeliverySocketEvent>;
      const payload = custom.detail;
      if (!payload || typeof payload !== "object") return;
      if (payload.sessionId && payload.sessionId !== sessionId) return;
      if (!playbackSchedulerRef.current) return;
      playbackSchedulerRef.current.receiveSocketEvent(payload);
    };
    window.addEventListener("optima:socket-event", onSocketEvent as EventListener);
    return () => window.removeEventListener("optima:socket-event", onSocketEvent as EventListener);
  }, [sessionId]);
  useEffect(() => {
    (window as any).OPTIMA_PLAYBACK_DEBUG = {
      getState: () => deliveryState,
      queue: deliveryState.playbackQueue,
      isTyping: deliveryState.isTyping,
      currentPlayback: deliveryState.currentPlayback,
      lastDeliveryEvent: deliveryState.lastDeliveryEvent,
      timers: deliveryState.timers,
    };
  }, [deliveryState]);
  const humanAgent = useMemo(
    () =>
      storedSession
        ? {
            name: storedSession.agent_name,
            personality: storedSession.agent_personality,
            salesStyle: storedSession.sales_style,
            avatar: storedSession.conversation_state?.agent_profile?.avatar ?? "",
            accentFrom: storedSession.conversation_state?.agent_profile?.accent?.from ?? "",
            accentTo: storedSession.conversation_state?.agent_profile?.accent?.to ?? "",
          }
        : { name: "Service client", personality: "chaleureux" as const, salesStyle: "conseiller" as const, avatar: "", accentFrom: "", accentTo: "" },
    [storedSession],
  );

  const defaultAccent = { from: "rgba(74,155,134,0.92)", to: "rgba(196,138,76,0.68)" } as const;
  const accent = useMemo(() => {
    const lockedAccent = lockedPersona?.accent;
    if (!mounted && lockedAccent?.from && lockedAccent?.to) return lockedAccent;
    const from = String((humanAgent as any).accentFrom ?? "").trim();
    const to = String((humanAgent as any).accentTo ?? "").trim();
    if (from && to) return { from, to };
    if (lockedAccent?.from && lockedAccent?.to) return lockedAccent;
    return defaultAccent;
  }, [mounted, lockedPersona?.accent, (humanAgent as any).accentFrom, (humanAgent as any).accentTo]);

  const accentStyle = useMemo(
    () =>
      ({
        ["--agent-accent-from" as any]: accent.from,
        ["--agent-accent-to" as any]: accent.to,
      }) as React.CSSProperties,
    [accent.from, accent.to],
  );

  const agentAvatarUrl = useMemo(() => {
    const fromSession = String(storedSession?.conversation_state?.agent_profile?.avatar ?? "").trim();
    if (fromSession) return fromSession;
    if (lockedPersona?.avatar) return lockedPersona.avatar;
    const id = storedSession?.conversation_state?.agent_profile?.id;
    const fromId = id ? getCommercialAgentById(id)?.avatar : undefined;
    if (fromId) return fromId;
    return rosterAvatarFallbackForName(humanAgent.name);
  }, [
    storedSession?.conversation_state?.agent_profile?.avatar,
    storedSession?.conversation_state?.agent_profile?.id,
    humanAgent.name,
    lockedPersona?.avatar,
  ]);

  const agentRoleLabel = useMemo(() => {
    const fromSession = String(storedSession?.conversation_state?.agent_profile?.role ?? "").trim();
    if (fromSession) return fromSession;
    if (lockedPersona?.role) return lockedPersona.role;
    const id = storedSession?.conversation_state?.agent_profile?.id;
    return (id && getCommercialAgentById(id)?.role) || "Conseiller commercial";
  }, [
    storedSession?.conversation_state?.agent_profile?.role,
    storedSession?.conversation_state?.agent_profile?.id,
    lockedPersona?.role,
  ]);

  function refreshConversationPreviews(map: Record<string, number>) {
    if (typeof window === "undefined") return;
    const out: ConversationPreview[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || !k.startsWith("chat_session_")) continue;
        const s = k.replace("chat_session_", "");
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as any;
        const messages = Array.isArray(parsed?.messages) ? parsed.messages : [];
        const last = messages[messages.length - 1];
        const lastTs = last?.ts ? new Date(last.ts).getTime() : Number(parsed?.created_at ?? Date.now());
        const preview = typeof last?.content === "string" ? last.content : "";
        const avatarFromSession = parsed?.conversation_state?.agent_profile?.avatar;
        out.push({
          slug: s,
          businessName: s === slug ? agentName : String(parsed?.agent_name || parsed?.business_name || "Conversation"),
          preview: preview || "Conversation prete",
          unread: Math.max(0, Number(map[s] ?? 0)),
          avatarUrl: typeof avatarFromSession === "string" ? avatarFromSession : undefined,
          lastTs: Number.isFinite(lastTs) ? lastTs : Date.now(),
        });
      }
    } catch {
      // ignore local parsing errors
    }
    out.sort((a, b) => b.lastTs - a.lastTs);
    setConversationPreviews(out);
  }

  const lastActiveLabel = useMemo(() => {
    const ms = storedSession?.conversation_state?.stats?.last_active_at;
    if (typeof ms !== "number" || !ms) return "Actif il y a quelques secondes";
    return formatRelativeLastActive(ms);
  }, [storedSession?.conversation_state?.stats?.last_active_at, messages.length]);

  const office = useMemo(() => getOfficeHoursLabel(new Date()), []);

  const agentStatusHint = useMemo(() => {
    const fromSession = String(storedSession?.conversation_state?.agent_profile?.statusHint ?? "").trim();
    if (fromSession) return fromSession;
    if (lockedPersona?.statusTagline) return lockedPersona.statusTagline;
    const id = storedSession?.conversation_state?.agent_profile?.id;
    return (id && getCommercialAgentById(id)?.statusTagline) || office.hint;
  }, [
    storedSession?.conversation_state?.agent_profile?.statusHint,
    storedSession?.conversation_state?.agent_profile?.id,
    lockedPersona?.statusTagline,
    office.hint,
  ]);

  const statusText = useMemo(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user" && !m.typing)?.content ?? "";
    return contextualStatus({ lastUserMessage: lastUser, officeStatus: office.status as any });
  }, [messages, office.status]);

  const lastHydratedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      setSoundsOn(window.localStorage.getItem("optima_chat_sounds") === "1");
      const rawUnread = window.localStorage.getItem("optima_chat_unread_map_v1");
      if (rawUnread) {
        const parsed = JSON.parse(rawUnread) as Record<string, number>;
        if (parsed && typeof parsed === "object") setUnreadMap(parsed);
      }
    } catch {
      // ignore
    }
    if (!storedSession) return;

    const slugChanged = lastHydratedSlugRef.current !== slug;
    lastHydratedSlugRef.current = slug;

    const diskMsgs = storedSession.messages;
    const diskCount = diskMsgs.length;
    const localCount = messagesRef.current.filter((m) => !m.typing).length;

     // Always reset when switching conversation; otherwise never replace UI with a *shorter* disk
     // snapshot (stale session ref / race after persist would clear the thread on mobile).
     if (isConversationUiCleared(storedSession)) {
       if (diskCount === 0) {
         if (slugChanged || localCount > 0) setMessages([]);
       } else {
         const shouldTakeCleared =
           slugChanged || localCount === 0 || (diskCount > localCount && diskCount > 0);
         if (shouldTakeCleared) {
           setMessages(
             toUiMessages({
               messages: dedupeThreadMessages(diskMsgs) as StoredMessage[],
               session: storedSessionRef.current,
             }),
           );
         }
       }
     } else {
       const shouldTakeDisk =
         slugChanged || (localCount === 0 && diskCount > 0) || (diskCount > localCount && diskCount > 0);
       if (shouldTakeDisk) {
         setMessages(
           toUiMessages({
             messages: dedupeThreadMessages(diskMsgs) as StoredMessage[],
             session: storedSessionRef.current,
           }),
         );
       }
     }

    setUnreadMap((prev) => ({ ...prev, [slug]: 0 }));
    setUnseenCount(0);
  }, [storedSession, slug]);

  useEffect(() => {
    // Immersive mode for public chat (reduces "browser/SaaS" feeling).
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-immersive-chat", "1");
    return () => {
      root.removeAttribute("data-immersive-chat");
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem("optima_chat_sounds", soundsOn ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soundsOn, mounted]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("optima_chat_dark_mode");
    setDarkMode(raw === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("optima_chat_dark_mode", darkMode ? "1" : "0");
  }, [darkMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("optima_chat_background_mode");
    if (raw === "mesh" || raw === "blur" || raw === "noise" || raw === "paper") setBackgroundMode(raw);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("optima_chat_background_mode", backgroundMode);
  }, [backgroundMode]);

  useEffect(() => {
    const idleLines = [
      "En ligne",
      "Répond rapidement",
      "Service commercial",
      "Support commande",
      "Conseiller boutique",
      "Disponible pour vous",
    ];
    const id = window.setInterval(() => {
      const pick = idleLines[Math.floor(Math.random() * idleLines.length)] ?? "En ligne";
      setIdlePresence(pick);
    }, 10_000 + Math.round(Math.random() * 9_000));
    return () => window.clearInterval(id);
  }, []);

  function playIncomingTick() {
    if (!soundsOn) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 740;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.06, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0002, now + 0.12);
      o.start(now);
      o.stop(now + 0.13);
      window.setTimeout(() => ctx.close().catch(() => {}), 220);
    } catch {
      // ignore
    }
  }

  function playOutgoingTick() {
    if (!soundsOn) return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = 520;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.045, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0002, now + 0.08);
      o.start(now);
      o.stop(now + 0.09);
      window.setTimeout(() => ctx.close().catch(() => {}), 180);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (!mounted || !storedSession) return;
    if (isConversationUiCleared(storedSession)) return;
    const state = storedSession.conversation_state ?? {};
    const introDone = Boolean((state as any).intro_done);
    if (introDone) return;
    if (storedSession.messages.length > 0) return;

    (async () => {
      try {
        // Mark intro as done immediately to avoid double-firing on refresh.
        const nextState = { ...(state as any), intro_done: true, stats: { ...(state as any).stats, last_active_at: Date.now() } };
        const baseIntro = loadSession(slug) ?? storedSession;
        saveSession(slug, { ...baseIntro, conversation_state: nextState });

        await sleep(700 + Math.round(Math.random() * 900));
        const typingId = crypto.randomUUID();
        setMessages((prev) => prev.concat({ id: typingId, role: "assistant", content: "typing", ts: new Date().toISOString(), typing: true, animateIn: "left" }));
        await sleep(1600 + Math.round(Math.random() * 2200));
        setMessages((prev) => prev.filter((x) => x.id !== typingId));

        const name = storedSession.agent_name || "Conseiller";
        const bubbles = [
          `Bonsoir. Bienvenue chez ${agentName}.`,
          `Je suis ${name} du service client.`,
          "Dites-moi ce que vous cherchez et votre budget, je vous aide tout de suite.",
        ];
        await emitAssistantBubbles({ bubbles, baseTsIso: new Date().toISOString() });
      } catch {
        // ignore
      }
    })();
    // Intentionally depends only on mounted/storedSession identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, storedSession]);

  useEffect(() => {
    return () => {
      for (const t of timeoutsRef.current) window.clearTimeout(t);
      timeoutsRef.current = [];
    };
  }, []);

  function excerpt(m: UiMessage) {
    const t = String(m.content ?? "").trim().replace(/\s+/g, " ");
    if (m.kind === "image") return "📷 Photo";
    if (m.kind === "audio") return "🎤 Note vocale";
    return t.length > 80 ? t.slice(0, 80) + "…" : t;
  }

  function productImageForTitle(title: string) {
    const pool = [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1600269452121-4f2416e55c28?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1556048219-bb6978360b84?auto=format&fit=crop&w=300&q=80",
      "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=300&q=80",
    ];
    const idx = Math.abs(Array.from(String(title)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)) % pool.length;
    return pool[idx]!;
  }

  function tryExtractProductCard(content: string) {
    const c = String(content ?? "").trim();
    if (!c) return null;
    const hasProductContext = /\b(produit|modele|mod[eè]le|article|disponible|stock|prix|fcfa|cfa)\b/i.test(c);
    if (!hasProductContext) return null;
    const price = c.match(/(\d[\d\s]{2,12}\s?(?:FCFA|CFA))/i)?.[1]?.replace(/\s+/g, " ");
    const availability = /\b(disponible|en stock)\b/i.test(c) ? "Disponible" : /\b(rupture|indisponible)\b/i.test(c) ? "Stock limite" : "Verifier";
    const title =
      c.match(/(?:modele|produit|article)\s*[:\-]?\s*([A-Za-z0-9À-ÖØ-öø-ÿ' -]{3,40})/i)?.[1]?.trim() ??
      "Selection recommandee";
    if (!price && !/\b(prix)\b/i.test(c)) return null;
    return { title, price: price ?? "Prix sur demande", availability, image: productImageForTitle(title) };
  }

  function getSalesBadge(product: { availability: string; price: string }) {
    if (/stock limite/i.test(product.availability)) return { label: "Stock faible", tone: "amber" as const };
    if (/prix sur demande/i.test(product.price)) return { label: "Nouveau", tone: "slate" as const };
    return { label: "Top vente", tone: "emerald" as const };
  }

  function canGoBack() {
    try {
      return typeof window !== "undefined" && window.history.length > 1;
    } catch {
      return false;
    }
  }

  function goBack() {
    try {
      if (canGoBack()) window.history.back();
    } catch {
      // ignore
    }
  }

  async function onPickImage(file: File | null) {
    if (!file) return;
    setPendingImageName(file.name || "image");
    setImageSendProgress(0);
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  function clearPendingImage() {
    setPendingImage(null);
    setPendingImageName("");
    setImageSendProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/chat/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, session_id: sessionId }),
      });
      const data = (await res.json().catch(() => null)) as {
        agent?: { id?: string };
        persona?: CommercialAgentPublic;
        messages?: StoredMessage[];
        message?: string;
        error?: string;
      } | null;
      if (cancelled) return;
      if (!res.ok) {
        const msg =
          typeof data?.message === "string"
            ? data.message
            : res.status === 403
              ? "Le chat public nécessite un abonnement Pro actif."
              : res.status === 404
                ? "Lien de chat invalide ou agent désactivé."
                : "Impossible d'initialiser le chat.";
        setInitError(msg);
        return;
      }
      setInitError(null);
      if (data?.agent?.id) setAgentId(String(data.agent.id));

      const persona = data?.persona ?? lockedPersona ?? null;
      if (persona && data) {
        const merged = getOrCreateSession(slug, persona);
        const srv = Array.isArray(data.messages) ? data.messages : [];
        if (!isConversationUiCleared(merged) && srv.length > merged.messages.length) {
          const nextSession: StoredChatSession = {
            ...merged,
            messages: srv.slice(-MAX_STORED_MESSAGES),
          };
          saveSession(slug, nextSession);
          setLocalSessionTick((x) => x + 1);
          setMessages(
            toUiMessages({
              messages: dedupeThreadMessages(nextSession.messages) as StoredMessage[],
              session: nextSession,
            }),
          );
        } else {
          setLocalSessionTick((x) => x + 1);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, sessionId, lockedPersona?.id]);

  useEffect(() => {
    if (!agentId || !sessionId || !mounted) return;
    const id = window.setInterval(async () => {
      if (inFlightRef.current) return;
      if (Date.now() < syncSuppressUntilRef.current) return;
      const sess = loadSession(slug) ?? storedSessionRef.current;
      if (isConversationUiCleared(sess)) return;
      try {
        const res = await fetch("/api/chat/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_id: agentId, session_id: sessionId }),
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as any;
        const srv: StoredMessage[] = Array.isArray(data?.messages) ? data.messages : [];
        const localCount = messagesRef.current.filter((m) => !m.typing).length;
        if (srv.length <= localCount) return;
        const delta = srv.slice(localCount);
        const toAdd = delta.filter((sm) => sm.role === "assistant" && String(sm.content ?? "").trim());
        if (toAdd.length === 0) return;
        setMessages((prev) => {
          if (isConversationUiCleared(loadSession(slug) ?? storedSessionRef.current)) return prev;
          let next = prev;
          const existingIds = new Set(prev.map((m) => m.id));
          for (const sm of toAdd) {
            const content = String(sm.content ?? "").trim();
            const id = sm.id?.trim() || newMessageId();
            if (existingIds.has(id)) continue;
            existingIds.add(id);
            const alreadySame = next.some(
              (m) => !m.typing && m.role === "assistant" && m.ts === sm.ts && String(m.content ?? "").trim() === content,
            );
            if (alreadySame) continue;
            next = next.concat({
              id,
              role: "assistant",
              content: sm.content,
              ts: sm.ts,
              animateIn: "left",
            });
          }
          // Keep legitimate repeated assistant replies across turns.
          // Only strip typing placeholders before merge.
          next = next.filter((m) => !m.typing) as UiMessage[];
          const typing = prev.filter((m) => m.typing);
          next = [...next, ...typing];
          persistFromUi(next);
          return next;
        });
        playIncomingTick();
        triggerMobileHaptic(12);
        window.requestAnimationFrame(() => scrollThreadToBottom("smooth"));
      } catch {
        /* ignore */
      }
    }, 12_000);
    return () => window.clearInterval(id);
  }, [agentId, sessionId, mounted, slug, scrollThreadToBottom]);

  useEffect(() => {
    // Auto-scroll après rendu du fil (évite scroll avant layout).
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => scrollThreadToBottom("smooth"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [messages.length, messages.some((m) => m.typing), scrollThreadToBottom]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    function computeIsAtBottom() {
      const thresholdPx = 72;
      return el!.scrollHeight - el!.scrollTop - el!.clientHeight <= thresholdPx;
    }

    function onScroll() {
      const isAtBottom = computeIsAtBottom();
      setAtBottom(isAtBottom);
      if (isAtBottom) setUnseenCount(0);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();

    return () => {
      el.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", onScroll as any);
    };
  }, []);

	  useEffect(() => {
    try {
      window.localStorage.setItem("optima_chat_unread_map_v1", JSON.stringify(unreadMap));
    } catch {
      // ignore
    }
    refreshConversationPreviews(unreadMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadMap, slug, agentName]);

  useEffect(() => {
    setUnreadMap((prev) => {
      const next = { ...prev, [slug]: unseenCount };
      return next;
    });
  }, [slug, unseenCount]);

  useEffect(() => {
    const visible = messages.filter((m) => !m.typing);
    const assistantCount = visible.filter((m) => m.role === "assistant").length;
    const prev = lastAssistantCountRef.current;
    if (assistantCount <= prev) {
      lastAssistantCountRef.current = assistantCount;
      return;
    }

    const added = assistantCount - prev;
    const tabVisible = typeof document !== "undefined" ? document.visibilityState === "visible" : true;
    if (atBottom && tabVisible) {
      setUnseenCount(0);
    } else {
      setUnseenCount((c) => c + added);
    }
    lastAssistantCountRef.current = assistantCount;
  }, [messages, atBottom]);

  useEffect(() => {
    function markConversationOpened() {
      setUnseenCount(0);
      setUnreadMap((prev) => ({ ...prev, [slug]: 0 }));
    }
    function onVisibility() {
      if (document.visibilityState === "visible") markConversationOpened();
    }
    window.addEventListener("focus", markConversationOpened);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", markConversationOpened);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function scrollToBottom() {
    scrollThreadToBottom("smooth");
    setUnseenCount(0);
    setAtBottom(true);
  }

	  function persistFromUi(ui: UiMessage[]) {
	    // Always merge onto the latest disk snapshot so we never clobber messages with a stale React/ref session.
	    const sess = loadSession(slug) ?? storedSessionRef.current;
	    if (!sess) return;
	    const visible = ui.filter((m) => !m.typing);
	    if (isConversationUiCleared(sess) && visible.length === 0) {
	      try {
	        saveSession(slug, { ...sess, messages: [] });
	      } catch (e) {
	        console.error("[CHAT] persistFromUi clear-guard error", e);
	      }
	      return;
	    }
	    const persisted: StoredMessage[] = dedupeThreadMessages(
	      ui
	        .filter((m) => !m.typing)
	        .slice(-MAX_STORED_MESSAGES)
	        .map((m) => ({
	        id: m.id,
	        role: m.role,
	        content: m.content,
	        ts: m.ts,
	        kind: m.kind,
	        image_data_url: m.image_data_url,
	        audio_data_url: m.audio_data_url,
	        audio_duration_ms: m.audio_duration_ms,
	        voice_transcript: m.voice_transcript,
	        reply_to_id: m.reply_to_id,
	        reactions: m.reactions,
	        delivered_at: m.delivered_at,
	        read_at: m.read_at,
	      })),
	    ) as StoredMessage[];
	    try {
	      saveSession(slug, { ...sess, messages: persisted });
	    } catch (e) {
	      console.error("[CHAT] persistFromUi error", e);
	    }
	  }

  function updateConversationStateWithUserMessage(userMessage: string) {
    if (!storedSession) return;
    try {
      const state = storedSession.conversation_state ?? {
        language: "fr" as const,
        preferences: { blacklist: [] },
        mood: "",
        memory: [],
        tone_mode: "conversation_naturelle",
        stats: { turn_count: 0, fatigue: 0, last_active_at: Date.now() },
      };
      const recent = storedSession.messages.slice(-11).map((m) => ({ role: m.role, content: m.content }));
      state.language = detectConversationLanguage({
        message: userMessage,
        previous: state.language,
        history: [...recent, { role: "user" as const, content: userMessage }],
      });
      const blacklist = Array.isArray(state.preferences?.blacklist) ? state.preferences!.blacklist! : [];
      const m = userMessage.toLowerCase();
      if (/(arr[eê]te|stop).*(demander|pose).*(services|infos|informations)/.test(m)) {
        const next = Array.from(new Set([...blacklist, "ne plus demander si je cherche vos services"])).slice(0, 30);
        state.preferences = { ...(state.preferences ?? {}), blacklist: next };
      }

      // Extract temporary commercial memory from the prospect message.
      // This helps the agent avoid repetition and sound more "in control".
      const memory = Array.isArray(state.memory) ? state.memory.slice(0, 20) : [];
      const key = (k: string) => `${k}:`;
      const upsert = (k: string, v: string) => {
        const value = String(v ?? "").trim();
        if (!value) return;
        const lowerPrefix = key(k).toLowerCase();
        const filtered = memory.filter((x) => !String(x ?? "").toLowerCase().startsWith(lowerPrefix));
        filtered.unshift(`${k}: ${value}`);
        // Keep only the newest 20 slots (prompt uses slice(0,20)).
        memory.splice(0, memory.length, ...filtered.slice(0, 20));
      };

      // Prénom
      const nameMatch = userMessage.match(/(?:je\s*m'appelle|mon\s*prénom|prénom\s*:|je\s*suis|s'appelle)\s+([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,30})/iu);
      if (nameMatch?.[1]) upsert("Prénom", nameMatch[1]);

      // Budget (FCFA/CFA or "budget/max/plafond")
      const budgetMatch1 = userMessage.match(/(?:budget|max(?:imum)?|plafond)\s*[:=]?\s*(\d[\d\s]{0,9})\s*(fcfa|cfa)?/iu);
      const budgetMatch2 = userMessage.match(/(\d[\d\s]{0,9})\s*(fcfa|cfa)\b/iu);
      if (budgetMatch1?.[1]) {
        const amount = String(budgetMatch1[1]).replace(/\s+/g, " ").trim();
        const cur = budgetMatch1[2] ? ` ${budgetMatch1[2].toUpperCase()}` : " FCFA";
        upsert("Budget", `${amount}${cur}`);
      } else if (budgetMatch2?.[1]) {
        const amount = String(budgetMatch2[1]).replace(/\s+/g, " ").trim();
        upsert("Budget", `${amount} ${String(budgetMatch2[2]).toUpperCase()}`);
      }

      // Couleur
      const colorMatch = userMessage.match(/(?:couleur|coloris)\s+([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,24}(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ'-]{2,24})?)/iu);
      if (colorMatch?.[1]) upsert("Couleur", colorMatch[1].trim());

      // Taille
      const sizeMatch = userMessage.match(/(?:taille|size)\s+([A-Za-z0-9À-ÖØ-öø-ÿ'-]{1,10})/iu);
      if (sizeMatch?.[1]) upsert("Taille", sizeMatch[1].trim());

      // Localisation (ville / quartier / zone)
      const locMatch =
        userMessage.match(/(?:je\s*suis\s*(?:à|a|au)|j'habite\s*(?:à|a)|sur|dans)\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,40})/iu) ??
        userMessage.match(/(?:ville|quartier|zone|commune)\s*[:=]?\s*([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,40})/iu);
      if (locMatch?.[1]) upsert("Localisation", locMatch[1].trim().replace(/\s+/g, " ").slice(0, 32));

      // Urgence / timing
      if (/\b(urgent|vite|aujourd'hui|ce\s*soir|demain|maintenant|tout\s*de\s*suite|tt\s*suite|rapidement)\b/i.test(userMessage)) {
        const when =
          userMessage.match(/\b(aujourd'hui|ce\s*soir|demain|maintenant)\b/i)?.[1] ??
          (/\burgent|vite|rapidement\b/i.test(userMessage) ? "urgent" : "");
        if (when) upsert("Urgence", when.toLowerCase());
      }

      // Niveau d'intérêt / intention d'achat
      if (/\b(je\s*prends|je\s*le\s*prends|je\s*commande|je\s*veux|ok\s*je\s*prends|on\s*valide|je\s*valide|réserver|reserve|payer|paiement|livraison|adresse)\b/i.test(userMessage)) {
        upsert("Intention", "forte");
      } else if (/\b(prix|combien|disponible|stock|taille|couleur|détails|details)\b/i.test(userMessage)) {
        upsert("Intention", "intérêt");
      }

      // Hésitation
      if (/\b(hésite|hesite|peut[- ]?être|pas\s*sûr|pas\s*sur|je\s*sais\s*pas|je\s*réfléchis|on\s*verra|doute)\b/i.test(userMessage)) {
        upsert("Hésitation", "oui");
      }

      // Préférence produit (sport/sortie, homme/femme, etc.) — heuristique légère
      const prefMatch = userMessage.match(/\b(sport|sortie|ville|bureau|soirée|soiree|basket|talon|mocassin|sandale|chaussure)\b/iu);
      if (prefMatch?.[1]) upsert("Préférence", prefMatch[1].toLowerCase());

      // Produit demandé (heuristique)
      const prodMatch = userMessage.match(/(?:je\s*(?:cherche|veux|prends|commande|acheter)\s+|pour\s+)(.{3,90})/iu);
      if (prodMatch?.[1]) {
        const snippet = prodMatch[1].trim().replace(/\s+/g, " ");
        // Avoid grabbing generic phrases
        if (!/(bonjour|prix|livraison|paiement|disponible|stock|bonjour)/iu.test(snippet)) upsert("Produit", snippet.slice(0, 60));
      }

      // Problème / contrainte
      const probMatch = userMessage.match(/(?:j'ai|je\s*n'arrive pas|ça\s*ne\s*marche\s*pas|probl[eè]me|pb|erreur|b[ée]ug)\s*(.{0,90})/iu);
      if (probMatch?.[1]) {
        const snippet = probMatch[1].trim().replace(/\s+/g, " ");
        if (snippet) upsert("Problème", snippet.slice(0, 60));
      }

      state.memory = memory;

      // Lightweight stats for "human fatigue" + VIP attention.
      const stats = typeof state.stats === "object" && state.stats ? state.stats : { turn_count: 0, fatigue: 0, last_active_at: Date.now() };
      const last = typeof stats.last_active_at === "number" ? stats.last_active_at : Date.now();
      const turnCount = typeof stats.turn_count === "number" ? stats.turn_count : 0;
      const gapMin = Math.max(0, (Date.now() - last) / 60000);
      const recover = Math.min(0.25, gapMin / 120); // recover slowly if idle
      const addFatigue = 0.04 + Math.min(0.06, userMessage.trim().length / 2000); // grows with chat + long msgs
      const nextFatigue = clamp(0, (typeof stats.fatigue === "number" ? stats.fatigue : 0) - recover + addFatigue, 1);
      state.stats = { turn_count: turnCount + 1, fatigue: nextFatigue, last_active_at: Date.now() };

      // Save back (fresh disk base — same race as post-reply conversation_state merge on mobile).
      const baseState = loadSession(slug) ?? storedSession;
      saveSession(slug, { ...baseState, conversation_state: state });
    } catch (e) {
      console.error("[CHAT] updateConversationStateWithUserMessage error", e);
    }
  }

  function splitIntoBubbles(reply: string, opts: { rushed: boolean; fatigue01: number; lastUserMessage?: string }) {
    const raw = sanitizeAssistantReplyText(String(reply ?? "").trim());
    if (!raw) return [];
    const primaryIntent = detectResponsePrimaryIntent(opts.lastUserMessage ?? "");
    if (opts.rushed || primaryIntent === "location" || primaryIntent === "wellbeing" || primaryIntent === "thanks") {
      let o = orchestrateMessageBubbles({ text: raw, intent: primaryIntent, rushed: opts.rushed });
      o = dedupeAssistantMessageBubbles(o);
      o = collapseRedundantBubbleSplit(o);
      return o.length ? o : [raw];
    }

    const normalized = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();

    // Prefer explicit line breaks from model. If no line breaks, split on sentence-ish boundaries.
    const byLines = normalized
      .split(/\n+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const sentences =
      byLines.length >= 2
        ? byLines
        : normalized
            .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý0-9"“])/g)
            .map((s) => s.trim())
            .filter(Boolean);

    // Further split very long chunks to feel like multiple short mobile messages.
    const exploded: string[] = [];
    for (const s of sentences) {
      const chunk = String(s ?? "").trim();
      if (!chunk) continue;
      if (chunk.length <= 140) {
        exploded.push(chunk);
        continue;
      }

      // Try to split on natural pauses before doing any hard cut.
      const parts = chunk
        .split(/\s*(?:,|;|—|–|:)\s+/g)
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length <= 1) {
        exploded.push(chunk);
      } else {
        for (const p of parts) {
          if (p.length <= 140) exploded.push(p);
          else exploded.push(p.slice(0, 140).trim() + "…");
        }
      }
    }

    // Merge tiny fragments back (avoid one-word bubbles).
    const merged: string[] = [];
    for (const x of exploded) {
      const prev = merged[merged.length - 1];
      if (!prev) {
        merged.push(x);
        continue;
      }
      const isTiny = x.length < 18;
      const prevTiny = prev.length < 28;
      if (isTiny || prevTiny) {
        // Join softly (but keep it short).
        const joined = `${prev}${prev.endsWith("…") ? " " : " "}${x}`.replace(/\s+/g, " ").trim();
        merged[merged.length - 1] = joined.length <= 190 ? joined : prev;
        if (joined.length > 190) merged.push(x);
      } else {
        merged.push(x);
      }
    }

    const len = normalized.length;
    /** Réduit le découpage agressif — bug répétition bulle complète + fragments. */
    const maxBubbles = len < 100 ? 1 : len < 220 ? 2 : 3;
    const items = merged.slice(0, maxBubbles);
    if (items.length === 0) return [raw];

    // Micro-imperfections: very rare, mostly when fatigue is higher.
    const p = 0.01 + 0.03 * clamp(0, opts.fatigue01, 1);
    if (Math.random() < p) {
      const i = Math.min(items.length - 1, Math.floor(Math.random() * items.length));
      let s = items[i] ?? "";
      if (s.endsWith(".")) s = s.slice(0, -1);
      if (Math.random() < 0.4) s = s.replace(/\s+\b(Monsieur|Madame)\b/i, " $1"); // keep
      if (Math.random() < 0.35) s = s.replace(/,\s*/g, ", "); // slightly imperfect punctuation spacing
      items[i] = s;
    }

    const orchestrated = orchestrateMessageBubbles({
      text: items.join("\n"),
      intent: primaryIntent,
      rushed: opts.rushed,
      maxBubbles: Math.min(maxBubbles, 3),
    });
    let out = orchestrated.length ? orchestrated : items;
    out = dedupeAssistantMessageBubbles(out);
    out = collapseRedundantBubbleSplit(out);
    return out.length ? out : [raw];
  }

  async function emitAssistantAudio(args: {
    audioUrl: string;
    durationMs?: number;
    transcript?: string;
  }) {
    const cleared = isConversationUiCleared(loadSession(slug) ?? storedSessionRef.current);
    const hasVisible = messagesRef.current.some((m) => !m.typing);
    if (cleared && !hasVisible) return;
    const ts = new Date().toISOString();
    const assistantId = newMessageId();
    setMessages((prev) => {
      const next = prev.concat({
        id: assistantId,
        role: "assistant",
        content: args.transcript ?? "",
        ts,
        animateIn: "left",
        kind: "audio",
        audio_data_url: args.audioUrl,
        audio_duration_ms: args.durationMs,
        voice_transcript: args.transcript,
      });
      persistFromUi(next);
      return next;
    });
    playIncomingTick();
    triggerMobileHaptic(12);
  }

  function isActiveSendRequest(sendRequestId?: string): boolean {
    if (!sendRequestId) return true;
    return activeSendRef.current?.requestId === sendRequestId;
  }

  async function emitAssistantBubbles(args: {
    bubbles: string[];
    baseTsIso: string;
    timingSeed?: string;
    sendRequestId?: string;
    candidate?: boolean;
  }) {
    const cleared = isConversationUiCleared(loadSession(slug) ?? storedSessionRef.current);
    const hasVisible = messagesRef.current.some((m) => !m.typing);
    if (cleared && !hasVisible) {
      console.warn("[CHAT_UI_RENDER_FAILED]", { reason: "emit_blocked_ui_cleared", cleared, hasVisible });
      return;
    }
    if (!isActiveSendRequest(args.sendRequestId)) {
      console.warn("[CHAT_UI_RENDER_FAILED]", { reason: "emit_blocked_inactive_send", sendRequestId: args.sendRequestId });
      return;
    }
    const hourLocal = new Date().getHours();
    for (let i = 0; i < args.bubbles.length; i++) {
      if (!isActiveSendRequest(args.sendRequestId)) return;
      const bubble = args.bubbles[i]!;
      const ts = new Date().toISOString();
      const assistantId = newMessageId();
      setMessages((prev) => {
        console.log("[MESSAGES_BEFORE]", prev);
        const base = prev.filter((m) => !m.typing);
        const sameRequestSameBubble = base.some(
          (m) =>
            m.role === "assistant" &&
            m.request_id === args.sendRequestId &&
            String(m.content ?? "").trim() === String(bubble ?? "").trim(),
        );
        if (sameRequestSameBubble) return prev;
        const merged = base.concat({
          id: assistantId,
          role: "assistant",
          content: bubble,
          ts,
          animateIn: "left",
          request_id: args.sendRequestId,
          candidate: args.candidate === true,
        }) as UiMessage[];
        const typing = prev.filter((m) => m.typing);
        const next = [...merged, ...typing];
        persistFromUi(next);
        console.log("[MESSAGES_AFTER]", next);
        console.log("[CHAT_UI_RENDER_MESSAGES]", {
          stage: "emitAssistantBubbles_setMessages",
          prevLen: prev.length,
          nextLen: next.length,
          addedId: assistantId,
          addedRole: "assistant",
          addedContentLen: bubble.length,
          requestId: args.sendRequestId,
          candidate: args.candidate === true,
        });
        return next;
      });
      playIncomingTick();
      triggerMobileHaptic(12);
      if (i < args.bubbles.length - 1) {
        const nextB = args.bubbles[i + 1] ?? "";
        const gap = computeMultiBubblePauseMs({
          bubble,
          nextBubble: nextB,
          seed: (args.timingSeed ?? bubble) + String(i),
          bubbleIndex: i,
          hourLocal,
        });
        await sleep(gap);
        window.requestAnimationFrame(() => scrollThreadToBottom("smooth"));
      }
    }
  }

  async function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function toggleVoiceRecording() {
    if (!agentId || sending || inFlightRef.current) return;

    if (recordingVoice) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
        voiceStreamRef.current = null;
        setRecordingVoice(false);
        mediaRecorderRef.current = null;

        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 800) return;

        const durationMs = Math.max(500, Date.now() - voiceStartedAtRef.current);
        let dataUrl = "";
        try {
          dataUrl = await blobToDataUrl(blob);
        } catch {
          return;
        }

        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        form.append("durationMs", String(durationMs));
        form.append("hourLocal", String(new Date().getHours()));
        const sess = loadSession(slug) ?? storedSessionRef.current;
        if (sess?.conversation_state) {
          form.append("conversation_state", JSON.stringify(sess.conversation_state));
        }

        let transcript = "";
        try {
          const tr = await fetch("/api/chat/audio/transcribe", { method: "POST", body: form });
          const data = await tr.json();
          if (data?.ok && typeof data.text === "string" && data.text.trim()) {
            transcript = data.text.trim();
            if (data.conversation_state && sess) {
              saveSession(slug, {
                ...sess,
                conversation_state: {
                  ...(sess.conversation_state ?? {}),
                  ...(data.conversation_state as object),
                } as StoredChatSession["conversation_state"],
              });
              setLocalSessionTick((x) => x + 1);
            }
          }
        } catch (e) {
          console.warn("[VOICE_TRANSCRIBE]", e);
        }

        if (!transcript) transcript = "Note vocale";
        await sendCore({
          message: transcript,
          userSentVoice: true,
          userAudioDurationMs: durationMs,
          voiceNoteDataUrl: dataUrl,
        });
      };

      voiceStartedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingVoice(true);
      triggerMobileHaptic(6);
    } catch (e) {
      console.error("[VOICE_RECORD]", e);
      setRecordingVoice(false);
    }
  }

  async function send() {
    const message = input.trim();
    const hasImage = !!pendingImage;
    if ((!message && !hasImage) || !agentId || sending || inFlightRef.current) return;
    await sendCore({ message, hasImage });
  }

  type SendCoreOpts = {
    message: string;
    hasImage?: boolean;
    userSentVoice?: boolean;
    userAudioDurationMs?: number;
    voiceNoteDataUrl?: string;
  };

  async function sendCore(opts: SendCoreOpts) {
	    const message = opts.message.trim();
	    const hasImage = opts.hasImage === true;
	    if ((!message && !hasImage) || !agentId || sending || inFlightRef.current) return;

	    const sendFp = message.trim().toLowerCase();
	    const lastSend = lastSendFingerprintRef.current;
	    if (lastSend && lastSend.text === sendFp && Date.now() - lastSend.at < 4000) {
	      return;
	    }
	    lastSendFingerprintRef.current = { text: sendFp, at: Date.now() };

	    sendAbortRef.current?.abort();
	    const sendRequestId = crypto.randomUUID();
	    const sendAbort = new AbortController();
	    sendAbortRef.current = sendAbort;
	    activeSendRef.current = { requestId: sendRequestId, userMessage: message };
	    inFlightRef.current = true;
      triggerMobileHaptic(8);
	    setSending(true);
	    setInput("");
	    const localReplyTo = replyTo;
	    setReplyTo(null);
	    const localImage = pendingImage;
	    const localImageName = pendingImageName;
	    setPendingImage(null);
	    setPendingImageName("");
      setImageSendProgress(0);

    const nowIso = new Date().toISOString();
    const userMessageId = crypto.randomUUID();
    readTimerFiredRef.current = false;
	    typingStartedAtRef.current = null;
	    setReadReceiptMessageId(null);
      setAgentPresencePhase("online");
	    if (message) updateConversationStateWithUserMessage(message);

	    setMessages((prev) => {
	      const next: UiMessage[] = [
	        ...prev,
	        {
	          id: userMessageId,
	          role: "user",
	          content: message,
	          ts: nowIso,
	          animateIn: "right",
	          status: "sending",
	          kind: opts.voiceNoteDataUrl ? "audio" : localImage ? "image" : "text",
	          image_data_url: localImage ?? undefined,
	          audio_data_url: opts.voiceNoteDataUrl,
	          audio_duration_ms: opts.userAudioDurationMs,
	          voice_transcript: opts.userSentVoice ? message : undefined,
	          reply_to_id: localReplyTo?.id,
	        },
	      ];
	      persistFromUi(next);
	      return next;
	    });
      playOutgoingTick();

    const typingId = crypto.randomUUID();
    const startedAt = Date.now();
    const fatigue01 = clamp(0, storedSession?.conversation_state?.stats?.fatigue ?? 0, 1);
    const rushed = detectRushedUserMessage(message);
    const langUi = uiLangFromConversationState(storedSession?.conversation_state);
    const profileTone = storedSessionRef.current?.conversation_state?.conversationProfile?.tone;

    function setTypingVisible(visible: boolean) {
      setMessages((prev) => {
        const has = prev.some((m) => m.id === typingId);
        if (visible && has) return prev;
        if (!visible && !has) return prev;
        const next: UiMessage[] = visible
          ? [
              ...prev,
              { id: typingId, role: "assistant", content: "typing", ts: new Date().toISOString(), typing: true, animateIn: "left" as const },
            ]
          : prev.filter((x) => x.id !== typingId);
        persistFromUi(next);
        return next;
      });
    }

    try {
      console.log("[CHAT_UI_SEND_START]", {
        agentId,
        requestId: sendRequestId,
        hasText: Boolean(message),
        textLen: message.length,
        hasImage: Boolean(localImage),
        messagesLenBefore: messagesRef.current.length,
        visibleLenBefore: messagesRef.current.filter((m) => !m.typing).length,
        replyToId: localReplyTo?.id ?? null,
      });
      console.log("[CHAT] Envoi du message à /api/chat/send...", { message, agentId });
      const startTime = Date.now();
      
      // Human read + think + typing — rythme WhatsApp réaliste (indépendant de la latence API).
      const pauseBoost = clientEmotionalPauseBoost(message);
      const bodyBoost = digitalBodyLanguagePacingBoost(fatigue01);
      const bodyV2Boost = digitalBodyLanguageV2ReadBoost(fatigue01);
      const turnCount = storedSession?.conversation_state?.stats?.turn_count ?? 0;
      const hourLocal = new Date().getHours();
      const timingPlan = buildHumanTimingPlan({
        userMessage: message,
        seed: typingId,
        hourLocal,
        fatigue01,
        profileTone,
        turnCount,
        rushed,
      });
      const pacingMul = pauseBoost * bodyBoost * bodyV2Boost;
      const readDelay = Math.round(timingPlan.readDelayMs * pacingMul);
      const pauseAfterSeen = Math.round(timingPlan.pauseAfterSeenMs * pacingMul);
      let reflectionDelay = Math.round(timingPlan.reflectionBeforeTypingMs * pacingMul);
      if (isBareAcknowledgmentMessage(message)) {
        reflectionDelay = Math.round(reflectionDelay * 1.15);
      }

      // Kick off backend request immediately, but we won't show typing instantly.
      // Simulated upload/progress for images (keeps it "app-like" and not instant/robotic).
      let progressTimer: number | null = null;
      if (localImage) {
        setImageSendProgress(8);
        progressTimer = window.setInterval(() => {
          setImageSendProgress((p) => {
            const next = p + 6 + Math.round(Math.random() * 10);
            return next >= 92 ? 92 : next;
          });
        }, 180);
      }

      const clientAbortTimer = window.setTimeout(() => sendAbort.abort(), 70_000);
      const skipClientInterludes = messageRequiresMainReplyPipeline(message);
      const responsePromise = fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: sendAbort.signal,
        body: JSON.stringify({
	          message: message || (localImage ? `📷 ${localImageName || "Image"}` : ""),
          request_id: sendRequestId,
          agent_id: agentId,
          session_id: sessionId,
          agent_name: humanAgent.name,
          agent_personality: humanAgent.personality,
          business_name: agentName,
          sales_style: humanAgent.salesStyle,
	          history: messagesRef.current
	            .filter((m) => !m.typing)
	            .slice(-12)
	            .map((m) => ({
	              role: m.role,
	              content:
	                m.kind === "image"
	                  ? `[image] ${m.content || ""}`.trim()
	                  : m.kind === "audio"
	                    ? `[vocal] ${m.voice_transcript || m.content || ""}`.trim()
	                    : m.content,
	            })),
	          conversation_state: patchConversationStateForApi(
	            storedSession?.conversation_state as Record<string, unknown> | undefined,
	            storedSession ?? storedSessionRef.current,
	          ),
	          user_sent_voice: opts.userSentVoice === true,
	          user_audio_duration_ms: opts.userAudioDurationMs,
	        }),
      }).finally(() => window.clearTimeout(clientAbortTimer));

      // Sequence: message received -> delay read -> "vu" -> pause -> typing appears (non-instant) -> micro interruptions -> typing disappears -> reply arrives.
      await sleep(readDelay);
      readTimerFiredRef.current = true;
      setReadReceiptMessageId(userMessageId);
      setAgentPresencePhase("seen");
      {
        const now = new Date().toISOString();
        setMessages((prev) => prev.map((m) => (m.id === userMessageId ? { ...m, status: "read" as const, read_at: now } : m)));
      }
      window.requestAnimationFrame(() => scrollThreadToBottom("smooth"));
      await sleep(pauseAfterSeen);
      setAgentPresencePhase("thinking");
      await sleep(reflectionDelay);
      await sleep(humanConversationBreathingExtraMs(message));
      await sleep(microSilenceExtraReactionDelayMs(message));
      await sleep(
        Math.max(silenceIntelligenceExtraWaitMs(message, typingId), silencePsychologyExtraWaitMs(message, typingId)),
      );

      setReadReceiptMessageId(null);
      setAgentPresencePhase("writing");

      const reduceOptionalInterludes = microSilenceReduceOptionalInterludes(message, typingId);

      if (
        !skipClientInterludes &&
        !rushed &&
        !reduceOptionalInterludes &&
        shouldInjectHesitationBeat(message, typingId, rushed)
      ) {
        const hb = getHesitationBeat(langUi, message + typingId);
        await emitAssistantBubbles({
          bubbles: [hb.text],
          baseTsIso: new Date().toISOString(),
          sendRequestId,
          candidate: true,
        });
        if (hb.pauseAfterMs > 0) await sleep(hb.pauseAfterMs);
      } else if (
        !skipClientInterludes &&
        !rushed &&
        !reduceOptionalInterludes &&
        shouldInjectResponseBreathing({ userMessage: message, rushed, seed: typingId })
      ) {
        const rb = getResponseBreathingScript(langUi, message + typingId);
        for (const beat of rb) {
          await emitAssistantBubbles({
            bubbles: [beat.text],
            baseTsIso: new Date().toISOString(),
            sendRequestId,
            candidate: true,
          });
          if (beat.pauseAfterMs > 0) await sleep(beat.pauseAfterMs);
        }
      } else if (
        !skipClientInterludes &&
        !rushed &&
        !reduceOptionalInterludes &&
        shouldInjectThinkingInterruption({ userMessage: message, rushed })
      ) {
        const thinkScript = getThinkingInterruptionScript(langUi, message + typingId);
        for (const beat of thinkScript) {
          await emitAssistantBubbles({
            bubbles: [beat.text],
            baseTsIso: new Date().toISOString(),
            sendRequestId,
            candidate: true,
          });
          if (beat.pauseAfterMs > 0) await sleep(beat.pauseAfterMs);
        }
      } else if (
        !skipClientInterludes &&
        !rushed &&
        !reduceOptionalInterludes &&
        shouldInjectBackgroundActivity({ userMessage: message, rushed })
      ) {
        const script = getBackgroundActivityScript(langUi, message + typingId);
        for (const beat of script) {
          await emitAssistantBubbles({
            bubbles: [beat.text],
            baseTsIso: new Date().toISOString(),
            sendRequestId,
            candidate: true,
          });
          if (beat.pauseAfterMs > 0) await sleep(beat.pauseAfterMs);
        }
      } else if (
        !skipClientInterludes &&
        !rushed &&
        !reduceOptionalInterludes &&
        shouldInjectConversationBreak({ userMessage: message, rushed })
      ) {
        const brk = getConversationBreakScript(langUi, message + typingId);
        for (const beat of brk) {
          await emitAssistantBubbles({
            bubbles: [beat.text],
            baseTsIso: new Date().toISOString(),
            sendRequestId,
            candidate: true,
          });
          if (beat.pauseAfterMs > 0) await sleep(beat.pauseAfterMs);
        }
      } else if (
        !skipClientInterludes &&
        !rushed &&
        !reduceOptionalInterludes &&
        !isSocialSignalKind(detectSocialSignal(message))
      ) {
        // Premium human behavior: rare "service interlude" before the real reply.
        // INTERDIT sur salutations / small talk — pas de « Je vérifie » avant la vraie réponse.
        const msgLen = message.trim().length;
        const complex =
          msgLen > 90 ||
          /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(
            message,
          );
        const emotionalTemp = inferConversationEmotionalTemperature(message);
        const skipInterlude = emotionalTemp === "frustré" || emotionalTemp === "irrité";
        const style = humanAgent.personality === "chaleureux" ? ("reassuring" as const) : ("direct" as const);
        const chance = complex ? 0.32 : msgLen < 18 ? 0.08 : 0.14;
        if (!skipInterlude && Math.random() < chance) {
          const b1 = pickServiceInterlude({ lang: langUi, style, seed: message + typingId });
          await emitAssistantBubbles({
            bubbles: [b1],
            baseTsIso: new Date().toISOString(),
            sendRequestId,
            candidate: true,
          });
          await sleep(520 + Math.round(Math.random() * 1100));
          if (complex && style === "reassuring" && Math.random() < 0.22) {
            const b2 = pickServiceInterlude({ lang: langUi, style, seed: message + typingId + "b2" });
            if (b2 !== b1) {
              await emitAssistantBubbles({
                bubbles: [b2],
                baseTsIso: new Date().toISOString(),
                sendRequestId,
                candidate: true,
              });
            }
            await sleep(420 + Math.round(Math.random() * 900));
          }
        }
      }

      typingStartedAtRef.current = Date.now();
      {
        const now = new Date().toISOString();
        setMessages((prev) => prev.map((m) => (m.id === userMessageId ? { ...m, status: "delivered" as const, delivered_at: now } : m)));
      }

      // Start typing, but with "human" imperfections: brief stop/resume cycles while thinking.
      const typingStartAt = Date.now();
      setTypingVisible(true);

      let typingVisibleAt = Date.now();
      const allowInterrupts = !rushed && Math.random() < 0.82;
      const umsgLen = message.trim().length;

      let res: Response | null = null;
      let rhythmStep = 0;
      while (!res) {
        const step = 520 + Math.round(Math.random() * 680);
        const maybe = await Promise.race([responsePromise.then((r) => ({ done: true as const, r })), sleep(step).then(() => ({ done: false as const }))]);
        if (maybe.done) {
          res = maybe.r;
          break;
        }

        const elapsedTyping = Date.now() - typingStartAt;
        if (allowInterrupts && shouldApplyTypingRhythmBeat(typingId, rhythmStep, elapsedTyping)) {
          const beat = nextTypingRhythmBeat(typingId, rhythmStep);
          rhythmStep += 1;
          setTypingVisible(true);
          await sleep(beat.typingVisibleMs);
          setTypingVisible(false);
          await sleep(beat.typingHiddenMs);
          setTypingVisible(true);
          typingVisibleAt = Date.now();
        } else if (allowInterrupts && elapsedTyping > 2800) {
          if (
            shouldHumanTypingInterrupt({
              fatigue01,
              rushed,
              userMessageLen: umsgLen,
              elapsedWaitMs: elapsedTyping,
            })
          ) {
            setTypingVisible(false);
            await sleep(humanTypingPauseMs());
            setTypingVisible(true);
            typingVisibleAt = Date.now();
          } else if (
            shouldSecondaryTypingInterrupt({
              fatigue01,
              rushed,
              userMessageLen: umsgLen,
              elapsedWaitMs: elapsedTyping,
            })
          ) {
            setTypingVisible(false);
            await sleep(humanTypingPauseMs() + 400);
            setTypingVisible(true);
            typingVisibleAt = Date.now();
          }
        }
      }

      const responseTime = Date.now() - startTime;
      console.log(`[CHAT] Réponse reçue en ${responseTime}ms`, { status: res.status, ok: res.ok });
      
      let data: any = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        console.error("[CHAT] Erreur parse JSON", parseErr);
      }
      console.log("[API_RESPONSE]", data);
      console.log("[CHAT_UI_RESPONSE_RECEIVED]", {
        httpOk: res.ok,
        status: res.status,
        dataType: data === null ? "null" : Array.isArray(data) ? "array" : typeof data,
        dataKeys: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data) : null,
        replyLen: typeof data?.reply === "string" ? data.reply.length : null,
        request_id: data?.request_id,
      });

      if (progressTimer) {
        window.clearInterval(progressTimer);
        progressTimer = null;
        setImageSendProgress(100);
        window.setTimeout(() => setImageSendProgress(0), 350);
      }
      
      console.log("[CHAT] Données reçues:", {
        success: data?.success,
        replyLength: String(data?.reply ?? "").length,
        reply: data?.reply,
        error: data?.error,
        statusCode: res.status,
        request_id: data?.request_id,
      });

      if (!isActiveSendRequest(sendRequestId)) {
        console.warn("[CHAT] Réponse ignorée — tour périmé (requestId)", { sendRequestId });
        return;
      }
      if (data?.discarded === true) {
        console.warn("[CHAT] Réponse ignorée — request_id stale", {
          expected: sendRequestId,
          got: data?.request_id,
        });
        return;
      }
      if (data?.request_id && data.request_id !== sendRequestId) {
        // Backend can return a different request_id while still returning a valid reply.
        // Do not drop a good assistant message solely on this mismatch.
        console.warn("[CHAT] request_id mismatch (response kept)", {
          expected: sendRequestId,
          got: data?.request_id,
        });
      }
      if (typeof data?.user_message === "string" && data.user_message.trim() !== message.trim()) {
        console.warn("[CHAT] Réponse ignorée — user_message mismatch");
        return;
      }

      let reply: string;
      const serverError = data?.error ? String(data.error) : "";
      const trimmedReply = typeof data?.reply === "string" ? String(data.reply).trim() : "";

      const hardFailure =
        !res.ok || (data?.success === false && Boolean(serverError) && trimmedReply.length === 0);

      if (hardFailure) {
        console.warn("[CHAT] Erreur serveur — fallback client", {
          status: res.status,
          error: serverError || "HTTP_ERROR",
          success: data?.success,
        });
        await ensureMinTypingPauseBeforeFallback(Date.now() - typingVisibleAt);
        reply = pickClientHoldReply(langUi, message);
      } else if (trimmedReply.length > 0) {
        reply = sanitizeHoldReply({
          text: trimmedReply,
          lastUserMessage: message,
          agentName: humanAgent.name,
          businessName: agentName ?? "notre boutique",
          personaKey: agentId,
          lang: langUi,
          welcomeAlreadyDelivered: (loadSession(slug)?.conversation_state?.stats?.turn_count ?? 0) >= 2,
          allowEmoji: true,
        });
        console.log("[CHAT] Réponse IA:", reply);
      } else {
        console.error("[CHAT] Pas de réponse exploitable", { status: res.status, error: data?.error });
        await ensureMinTypingPauseBeforeFallback(Date.now() - typingVisibleAt);
        reply = pickClientHoldReply(langUi, message);
      }

	      console.log("message reçu", message);
	      console.log("agent_id", agentId);
	      console.log("réponse IA", reply);
        console.log("[ASSISTANT_REPLY]", reply);
        console.log("[CHAT_UI_APPEND_ASSISTANT]", {
          requestId: sendRequestId,
          replyLen: reply.length,
          messagesLenBeforeEmit: messagesRef.current.length,
          visibleLenBeforeEmit: messagesRef.current.filter((m) => !m.typing).length,
        });

	      setMessages((prev) => {
	        const next = prev.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m));
	        persistFromUi(next);
	        return next;
	      });

      const desiredTyping = Math.round(
        computeHumanTypingDurationMs({
          reply,
          seed: typingId + "final",
          hourLocal,
          rushed,
          fatigue01,
          busyLevel: timingPlan.busyLevel,
        }) * pacingMul,
      );
      const elapsedTyping = Date.now() - typingVisibleAt;
      const remainingTyping = Math.max(0, Math.max(timingPlan.minTypingMs, desiredTyping) - elapsedTyping);
      if (remainingTyping) await sleep(remainingTyping);

      setTypingVisible(false);
      window.requestAnimationFrame(() => scrollThreadToBottom("smooth"));

      setMessages((prev) => {
        console.log("[MESSAGES_BEFORE]", prev);
        const stripped = prev.filter((m) => !(m.candidate && m.request_id === sendRequestId));
        persistFromUi(stripped);
        console.log("[MESSAGES_AFTER]", stripped);
        return stripped;
      });

      const isVoiceReply = data?.delivery === "voice" && data?.audio_reply?.url;
      if (isVoiceReply) {
        const timing = data.audio_timing as { delayBeforeVoiceMs?: number; breathPauseMs?: number } | undefined;
        const preDelay = (timing?.delayBeforeVoiceMs ?? 1800) + (timing?.breathPauseMs ?? 0);
        if (preDelay > 0) await sleep(preDelay);
        await emitAssistantAudio({
          audioUrl: String(data.audio_reply.url),
          durationMs: Number(data.audio_reply.durationMs) || undefined,
          transcript: reply.length > 120 ? undefined : reply,
        });
      } else {
        const bubbles = dedupeAssistantMessageBubbles(
          splitIntoBubbles(reply, { rushed, fatigue01, lastUserMessage: message }),
        );
        syncSuppressUntilRef.current = Date.now() + 25_000;
        await emitAssistantBubbles({
          bubbles,
          baseTsIso: new Date().toISOString(),
          timingSeed: typingId,
          sendRequestId,
          candidate: false,
        });
      }
      if (data?.conversation_state && typeof data.conversation_state === "object") {
        const cur = loadSession(slug) ?? storedSessionRef.current;
        if (cur) {
          saveSession(slug, {
            ...cur,
            conversation_state: { ...(cur.conversation_state ?? {}), ...(data.conversation_state as object) } as StoredChatSession["conversation_state"],
          });
          setLocalSessionTick((x) => x + 1);
        }
      }
      setReadReceiptMessageId(null);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        console.warn("[CHAT] Envoi annulé (nouveau message ou timeout)");
        return;
      }
      console.error("[OPTIMA_AI_ERROR]", err);
      if (!isActiveSendRequest(sendRequestId)) return;
      const elapsedTyping =
        typingStartedAtRef.current != null ? Date.now() - typingStartedAtRef.current : Date.now() - startedAt;
      await ensureMinTypingPauseBeforeFallback(elapsedTyping);
      const reply = pickClientHoldReply(langUi, message);
      setTypingVisible(false);
      await emitAssistantBubbles({
        bubbles: [reply],
        baseTsIso: new Date().toISOString(),
        sendRequestId,
      });
      setReadReceiptMessageId(null);
    } finally {
      syncSuppressUntilRef.current = Date.now() + 25_000;
      setAgentPresencePhase("default");
      setSending(false);
      inFlightRef.current = false;
      if (activeSendRef.current?.requestId === sendRequestId) {
        activeSendRef.current = null;
      }
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const uiCleared = useMemo(
    () => isConversationUiCleared(storedSession ?? storedSessionRef.current),
    [storedSession, localSessionTick],
  );

  const isTyping = messages.some((m) => m.typing);
  const backendTyping = deliveryState.isTyping && deliveryState.currentPlayback !== "cancelled";
  const visibleMessages = useMemo(() => {
    const nonTyping = messages.filter((m) => !m.typing);
    if (uiCleared && nonTyping.length === 0) return [];
    return nonTyping;
  }, [messages, uiCleared]);
  const query = search.trim().toLowerCase();
  const displayedMessages = query
    ? visibleMessages.filter((m) => String(m.content ?? "").toLowerCase().includes(query))
    : visibleMessages;
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (visibleMessages.length > 0) {
      window.localStorage.setItem("optima_chat_hidden_history", "false");
    }
  }, [visibleMessages.length]);
  useEffect(() => {
    try {
      const last = displayedMessages[displayedMessages.length - 1];
      console.log("[CHAT_UI_RENDER_MESSAGES]", {
        messagesLen: messages.length,
        visibleLen: visibleMessages.length,
        displayedLen: displayedMessages.length,
        queryActive: Boolean(query),
        query,
        lastRole: last?.role,
        lastContentLen: String(last?.content ?? "").length,
        lastId: last?.id,
      });
      if (visibleMessages.length > 0 && displayedMessages.length === 0) {
        console.warn("[CHAT_UI_RENDER_FAILED]", {
          reason: "search_filter_hides_messages",
          query,
          visibleLen: visibleMessages.length,
        });
      }
    } catch (e) {
      console.warn("[CHAT_UI_RENDER_FAILED]", { reason: "render_log_exception", e });
    }
  }, [messages.length, visibleMessages.length, displayedMessages.length, query]);
  const presenceStatus =
    agentPresencePhase === "writing" || isTyping
      ? "Réponse en préparation"
      : agentPresencePhase === "thinking"
        ? "Consultation en cours"
        : agentPresencePhase === "seen" || readReceiptMessageId
          ? "Traitement en cours"
          : agentPresencePhase === "online" || sending
            ? "Connecté"
            : statusText || idlePresence;

  const presenceDetail =
    agentPresencePhase === "writing" || isTyping
      ? `${humanAgent.name} prépare une réponse`
      : agentPresencePhase === "thinking"
        ? `${humanAgent.name} consulte votre demande`
        : agentPresencePhase === "seen" || readReceiptMessageId
          ? `${humanAgent.name} revient vers vous`
          : "";
  const selectedMessage = selectedMessageId ? displayedMessages.find((m) => m.id === selectedMessageId) ?? null : null;
  const nextBackground = () => {
    setBackgroundMode((prev) => (prev === "mesh" ? "blur" : prev === "blur" ? "noise" : prev === "noise" ? "paper" : "mesh"));
  };

  const clearConversationUi = () => {
    if (isClearingUi) return;
    setIsClearingUi(true);
    syncSuppressUntilRef.current = Date.now() + 86_400_000;
    sendAbortRef.current?.abort();
    sendAbortRef.current = null;
    inFlightRef.current = false;
    try {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch (e) {
      console.warn("[CHAT_UI_RENDER_FAILED]", { reason: "clear_stop_recorder_failed", e });
    }
    try {
      voiceStreamRef.current?.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore per-track stop failures
        }
      });
    } catch (e) {
      console.warn("[CHAT_UI_RENDER_FAILED]", { reason: "clear_stop_voice_stream_failed", e });
    }
    voiceStreamRef.current = null;
    setRecordingVoice(false);
    setSending(false);
    setAgentPresencePhase("default");
    setReadReceiptMessageId(null);
    setPendingImage(null);
    setPendingImageName("");
    setImageSendProgress(0);
    setReplyTo(null);
    setSelectedMessageId(null);
    setSearch("");
    setInput("");
    setUnseenCount(0);
    setUnreadMap((prev) => ({ ...prev, [slug]: 0 }));
    if (typeof window !== "undefined") {
      window.localStorage.setItem("optima_chat_hidden_history", "true");
    }
    if (fileRef.current) fileRef.current.value = "";

    const sess = loadSession(slug) ?? storedSessionRef.current;
    if (!sess) {
      window.setTimeout(() => {
        setMessages([]);
        setShowClearModal(false);
        setIsClearingUi(false);
      }, 220);
      setShowClearModal(false);
      return;
    }
    const uiArchive = archiveMessagesFromUi(messagesRef.current);
    const next = applyConversationUiClear(sess, { uiMessages: uiArchive });
    saveSession(slug, next);
    storedSessionRef.current = next;
    setLocalSessionTick((x) => x + 1);
    window.setTimeout(() => {
      setMessages([]);
      setShowClearModal(false);
      setIsClearingUi(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }, 220);
  };

  const exportConversationText = () => {
    const sess = loadSession(slug) ?? storedSessionRef.current;
    const pool = [
      ...visibleMessages,
      ...(sess?.ui_hidden_messages ?? []).map((m, i) => ({
        ...m,
        id: m.id ?? `arch_${i}`,
        role: m.role as "user" | "assistant",
      })),
    ];
    const lines = pool.map((m) => {
      const who = m.role === "user" ? "Prospect" : humanAgent.name;
      return `[${formatTime(m.ts)}] ${who}: ${m.content}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      className={`optima-chat-shell h-[100dvh] min-h-0 overflow-hidden ${darkMode ? "bg-[#0a0d11]" : ""}`}
      style={accentStyle}
      suppressHydrationWarning
    >
      <div className="mx-auto grid h-[100dvh] min-h-0 w-full max-w-[2200px] grid-cols-1 lg:p-3 min-[1400px]:p-4">
        <div
          className={`grid h-full min-h-0 w-full grid-cols-1 overflow-hidden transition-[grid-template-columns,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)] min-[1200px]:grid-cols-[minmax(0,11.75rem)_minmax(0,1fr)_minmax(0,11.75rem)] min-[1400px]:grid-cols-[minmax(0,12.25rem)_minmax(0,1fr)_minmax(0,12.25rem)] min-[1600px]:grid-cols-[minmax(0,12.75rem)_minmax(0,1fr)_minmax(0,12.75rem)] lg:rounded-xl lg:shadow-[0_1px_40px_rgba(15,23,42,0.04)] lg:ring-1 ${
            darkMode ? "lg:ring-white/[0.05]" : "lg:ring-slate-900/[0.04]"
          }`}
        >
        <ChatSidebar
          businessName={sanitizeUiLabel(agentName)}
          avatarUrl={agentAvatarUrl}
          status={presenceStatus}
          agentStatusHint={agentStatusHint}
          lastActiveLabel={lastActiveLabel}
          messages={visibleMessages.map((m) => ({ role: m.role, content: m.content, ts: m.ts }))}
          avatarOk={avatarOk}
          soundsOn={soundsOn}
          darkMode={darkMode}
          onToggleSounds={() => setSoundsOn((v) => !v)}
        />
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
          className={`cinema-center relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none backdrop-blur-[18px] ${
            darkMode ? "bg-[#0e1218]/88" : "bg-[linear-gradient(180deg,rgba(252,252,253,0.72)_0%,rgba(248,250,252,0.82)_40%,rgba(244,246,249,0.88)_100%)]"
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 ${
              backgroundMode === "mesh"
                ? darkMode
                  ? "bg-[radial-gradient(ellipse_90%_55%_at_50%_-18%,rgba(30,41,59,0.45),transparent_58%),radial-gradient(circle_at_92%_8%,rgba(52,120,103,0.05),transparent_40%),linear-gradient(175deg,#0c1016_0%,#0f141c_45%,#121a22_100%)]"
                  : "bg-[radial-gradient(ellipse_100%_58%_at_50%_-28%,rgba(255,255,255,0.85),transparent_55%),radial-gradient(circle_at_92%_0%,rgba(52,120,103,0.035),transparent_42%),linear-gradient(180deg,#fbfbfc_0%,#f5f6f8_55%,#f2f4f7_100%)]"
                : backgroundMode === "blur"
                  ? darkMode
                    ? "bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,rgba(99,125,168,0.09),transparent_50%),radial-gradient(circle_at_88%_12%,rgba(52,120,103,0.06),transparent_42%),linear-gradient(180deg,#0c1016,#101620)]"
                    : "bg-[radial-gradient(ellipse_75%_52%_at_18%_0%,rgba(99,125,168,0.07),transparent_52%),radial-gradient(circle_at_88%_10%,rgba(52,120,103,0.04),transparent_45%),linear-gradient(180deg,#fbfbfc,#f4f6f9)]"
                  : backgroundMode === "noise"
                    ? darkMode
                      ? "bg-[linear-gradient(178deg,#0b0f14_0%,#0f141c_50%,#121922_100%)]"
                      : "bg-[linear-gradient(178deg,#fcfcfd_0%,#f6f7f9_45%,#f1f3f6_100%)]"
                    : darkMode
                      ? "bg-[linear-gradient(180deg,#0e1218,#0b0f14)]"
                      : "bg-[linear-gradient(180deg,#fdfdfd,#f8f9fb)]"
            }`}
          />
          <div
            className={`pointer-events-none absolute inset-0 ${
              backgroundMode === "paper" ? "opacity-[0.11]" : darkMode ? "opacity-[0.065]" : "opacity-[0.085]"
            } [background-image:radial-gradient(rgba(15,23,42,0.14)_0.5px,transparent_0.5px)] [background-size:4px_4px]`}
          />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
          <ChatHeader
            agentName={humanAgent.name}
            agentRole={agentRoleLabel}
            businessName={sanitizeUiLabel(agentName)}
            agentAvatarUrl={agentAvatarUrl}
            avatarOk={avatarOk}
            initials={initials(humanAgent.name)}
            status={presenceStatus}
            search={search}
            onSearchChange={setSearch}
            darkMode={darkMode}
            typingActive={isTyping || agentPresencePhase === "writing"}
            onToggleDarkMode={() => setDarkMode((v) => !v)}
            onCycleBackground={nextBackground}
            onBack={goBack}
            onRequestClearConversation={() => setShowClearModal(true)}
            onExportConversation={exportConversationText}
            onRenameConversation={() => window.alert("Renommer — bientôt disponible.")}
            onArchiveConversation={() => window.alert("Archiver — bientôt disponible.")}
          />

          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <main
              ref={listRef}
              className="chat-thread-scroll relative z-10 min-h-0 flex-1 overflow-y-auto [touch-action:pan-y]"
            >
              <div
                data-thread-dark={darkMode ? "1" : undefined}
                className={`chat-thread-canvas relative mx-auto w-full max-w-[min(100%,820px)] px-4 py-3 min-[1200px]:max-w-[min(100%,880px)] min-[1200px]:px-6 min-[1200px]:py-4 min-[1400px]:max-w-[min(100%,940px)] min-[1600px]:max-w-[min(100%,1000px)] ${
                  darkMode ? "text-slate-100" : "text-slate-900"
                }`}
              >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: isClearingUi ? 0 : 1, y: isClearingUi ? 4 : 0, filter: isClearingUi ? "blur(1px)" : "blur(0px)" }}
              transition={{ duration: isClearingUi ? 0.2 : 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-[1] flex w-full flex-col gap-5 pb-28 min-[480px]:pb-12 lg:pb-8"
            >
              {visibleMessages.length === 0 && agentId && !initError ? (
                <ChatEmptyState
                  darkMode={darkMode}
                  agentName={humanAgent.name}
                  businessName={sanitizeUiLabel(agentName)}
                  avatarUrl={agentAvatarUrl}
                  avatarOk={avatarOk}
                  clearedByUser={uiCleared}
                  onStartNew={() => inputRef.current?.focus()}
                  onSuggestion={(text) => setInput(text)}
                />
              ) : null}

              {initError ? (
                <div
                  className={`mx-auto max-w-md rounded-xl border px-4 py-3 text-sm ${
                    darkMode
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                >
                  <p className="font-medium">Chat indisponible</p>
                  <p className="mt-1 opacity-90">{initError}</p>
                </div>
              ) : null}

              {visibleMessages.length === 0 && !agentId && !initError ? (
                <div className="space-y-2">
                  <div
                    className={`h-10 w-56 rounded-xl bg-gradient-to-r [background-size:200%_100%] [animation:shimmer_1.7s_infinite] ${
                      darkMode ? "from-slate-800/50 via-slate-700/40 to-slate-800/50" : "from-slate-100/80 via-white/90 to-slate-100/80"
                    }`}
                  />
                  <div
                    className={`ml-auto h-10 w-40 rounded-xl bg-gradient-to-r [background-size:200%_100%] [animation:shimmer_1.7s_infinite] [animation-delay:-0.3s] ${
                      darkMode ? "from-slate-800/50 via-slate-700/40 to-slate-800/50" : "from-slate-100/80 via-white/90 to-slate-100/80"
                    }`}
                  />
                </div>
              ) : null}

              {displayedMessages.map((m, idx) => {
                const key = m.id || `${m.ts}-${idx}`;
                const product = m.role === "assistant" ? tryExtractProductCard(m.content ?? "") : null;
                const isLastUser = m.role === "user" && m.id === [...displayedMessages].reverse().find((x) => x.role === "user")?.id;
                const prev = idx > 0 ? displayedMessages[idx - 1] : null;
                const next = idx < displayedMessages.length - 1 ? displayedMessages[idx + 1] : null;
                // Smart message grouping (mobile chat feel).
                // Tight window: messages sent within a few seconds feel like one block.
                const GROUP_WINDOW_MS = 9_000;
                const grouped = !!prev && prev.role === m.role && diffMs(prev.ts, m.ts) <= GROUP_WINDOW_MS;
                const groupedWithNext = !!next && next.role === m.role && diffMs(next.ts, m.ts) <= GROUP_WINDOW_MS;
                const groupPosition = grouped && groupedWithNext ? "middle" : groupedWithNext ? "start" : grouped ? "end" : "single";
                const showDayLabel = !prev || formatDayLabel(prev.ts) !== formatDayLabel(m.ts);
                return (
                  <div key={key} className={grouped ? "space-y-0.5" : "space-y-1"}>
                    {showDayLabel ? (
                      <div className="my-5 flex items-center justify-center">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide ${darkMode ? "bg-white/[0.06] text-slate-300" : "bg-slate-900/[0.05] text-slate-600"}`}>
                          {formatDayLabel(m.ts)}
                        </span>
                      </div>
                    ) : null}
                    <div className="message-glow" data-active={selectedMessageId === m.id ? "true" : "false"}>
                      <MessageBubble
                        id={m.id}
                        role={m.role}
                        content={m.content ?? ""}
                        kind={m.kind}
                        audioUrl={m.audio_data_url}
                        audioDurationMs={m.audio_duration_ms}
                        audioTranscript={m.kind === "audio" ? m.voice_transcript || m.content : undefined}
                        time={formatTime(m.ts)}
                        showAvatar={groupPosition === "single" || groupPosition === "end"}
                        avatarUrl={agentAvatarUrl}
                        avatarOk={avatarOk}
                        initials={initials(humanAgent.name)}
                        selected={selectedMessageId === m.id}
                        groupPosition={groupPosition}
                        readAtLabel={isLastUser && m.read_at ? `Vu à ${formatTime(m.read_at)}` : ""}
                        darkMode={darkMode}
                        onSelect={setSelectedMessageId}
                        reactions={m.reactions}
                        showRead={Boolean(isLastUser && m.status === "read")}
                        footerStatus={
                          isLastUser && m.role === "user"
                            ? m.status === "read"
                              ? "Vu"
                              : m.status === "delivered"
                                ? "Consulté"
                                : m.status === "sending"
                                  ? "Envoi…"
                                  : "Envoyé"
                            : ""
                        }
                        onSwipeReply={(id) => {
                          const target = messages.find((x) => x.id === id) ?? null;
                          if (!target) return;
                          setReplyTo(target);
                          triggerMobileHaptic(10);
                        }}
                      />
                    </div>
                    {product ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[89%] overflow-hidden rounded-lg shadow-sm ${m.role === "user" ? "ml-auto" : ""} ${darkMode ? "bg-[#1a221f]/90" : "bg-white/95"}`}
                      >
                        {(() => {
                          const badge = getSalesBadge(product);
                          const badgeClass =
                            badge.tone === "emerald"
                              ? "bg-[rgba(52,120,103,0.1)] text-[#3d6b5c] ring-1 ring-[rgba(52,120,103,0.12)]"
                              : badge.tone === "amber"
                                ? "bg-amber-500/[0.08] text-amber-900/80 ring-1 ring-amber-500/15"
                                : "bg-slate-500/[0.07] text-slate-600 ring-1 ring-slate-900/[0.06]";
                          return (
                            <div className="px-3 pt-3">
                              <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>{badge.label}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-stretch gap-3 p-3">
                          <img src={product.image} alt={product.title} className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" loading="lazy" />
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-semibold ${darkMode ? "text-slate-100" : "text-slate-800"}`}>{product.title}</p>
                            <p className={`mt-0.5 text-xs ${darkMode ? "text-slate-400" : "text-slate-600"}`}>{product.availability}</p>
                            <p className="mt-1 text-sm font-semibold text-[#3d6b5c]">{product.price}</p>
                          </div>
                        </div>
                        <div className={`border-t p-2 ${darkMode ? "border-white/[0.06] bg-black/20" : "border-slate-900/[0.05] bg-slate-50/40"}`}>
                          <button
                            onClick={() => {
                              setInput(`Je suis interesse par ${product.title}.`);
                              setReplyTo(m);
                              triggerMobileHaptic(8);
                            }}
                            className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition duration-200 ${
                              darkMode
                                ? "bg-white/[0.08] text-slate-200 hover:bg-white/[0.12]"
                                : "bg-white/90 text-[#3d6b5c] ring-1 ring-[rgba(52,120,103,0.15)] hover:bg-[rgba(52,120,103,0.06)]"
                            }`}
                          >
                            Je suis interesse
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                );
              })}
              {deliveryState.seenState !== "online" ? (
                <ChatSeenIndicator state={deliveryState.seenState} darkMode={darkMode} />
              ) : null}
              {!uiCleared && (isTyping || agentPresencePhase === "thinking" || backendTyping) ? (
                backendTyping ? (
                  <div className="flex items-end gap-2">
                    <div className="h-7 w-7 shrink-0" />
                    <TypingBubble darkMode={darkMode} />
                  </div>
                ) : (
                  <TypingIndicator
                    name={humanAgent.name}
                    avatarUrl={agentAvatarUrl}
                    avatarOk={avatarOk}
                    initials={initials(humanAgent.name)}
                    phase={agentPresencePhase === "writing" || isTyping ? "writing" : "thinking"}
                    subtitle={presenceDetail || undefined}
                    darkMode={darkMode}
                  />
                )
              ) : null}
              <div ref={bottomRef} />
            </motion.div>
              </div>
            </main>

          {!atBottom ? (
            <div className="pointer-events-none absolute bottom-[5.25rem] left-1/2 z-20 -translate-x-1/2 sm:bottom-[5.5rem] sm:left-auto sm:right-6 sm:translate-x-0">
              <button
                type="button"
                aria-label="Aller aux derniers messages"
                onClick={scrollToBottom}
                className={`pointer-events-auto flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11px] font-semibold tracking-wide shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur-md transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,23,42,0.16)] active:translate-y-0 active:scale-[0.98] ${
                  darkMode
                    ? "border-white/[0.08] bg-[#1a211e]/95 text-slate-100 ring-1 ring-white/[0.04]"
                    : "border-slate-900/[0.06] bg-white/95 text-slate-800 ring-1 ring-slate-900/[0.04]"
                }`}
              >
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${darkMode ? "text-[#8fb8aa]" : "text-[#3d6b5c]"}`} strokeWidth={2.25} aria-hidden />
                <span>Conversation récente</span>
                {unseenCount > 0 ? (
                  <span className={`tabular-nums ${darkMode ? "text-slate-400" : "text-slate-500"}`}>({unseenCount})</span>
                ) : null}
              </button>
            </div>
          ) : null}

          <div className="shrink-0">
            <div className="mx-auto w-full max-w-[min(100%,820px)] space-y-1.5 px-3 pb-1 min-[1200px]:max-w-[min(100%,880px)] min-[1200px]:px-5 min-[1400px]:max-w-[min(100%,940px)] min-[1600px]:max-w-[min(100%,1000px)]">
          {selectedMessage ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg p-2 ${darkMode ? "bg-white/[0.05]" : "bg-black/[0.03]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={`truncate text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Actions</div>
                <div className="flex items-center gap-1">
                  <button onClick={async () => { try { await navigator.clipboard.writeText(selectedMessage.content); } catch {} setSelectedMessageId(null); }} className={`rounded-lg px-2 py-1 text-xs ${darkMode ? "text-[#8fb8aa] hover:bg-white/[0.06]" : "text-[#3d6b5c] hover:bg-slate-900/[0.04]"}`}><Copy className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setReplyTo(selectedMessage); setSelectedMessageId(null); }} className={`rounded-lg px-2 py-1 text-xs ${darkMode ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-600 hover:bg-slate-900/[0.04]"}`}><Reply className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setMessages((prev) => { const next = prev.map((x) => x.id === selectedMessage.id ? { ...x, reactions: { ...(x.reactions ?? {}), "👍": ((x.reactions ?? {})["👍"] ?? 0) + 1 } } : x); persistFromUi(next); return next; }); setSelectedMessageId(null); }} className={`rounded-lg px-2 py-1 text-xs ${darkMode ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-600 hover:bg-slate-900/[0.04]"}`}><Smile className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { setMessages((prev) => { const next = prev.filter((x) => x.id !== selectedMessage.id); persistFromUi(next); return next; }); setSelectedMessageId(null); }} className="rounded-lg px-2 py-1 text-xs text-rose-600/90 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </motion.div>
          ) : null}

          {replyTo ? (
            <div className={`rounded-lg p-2 ${darkMode ? "bg-white/[0.05]" : "bg-black/[0.03]"}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={`text-[11px] font-medium ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Réponse</div>
                  <div className={`truncate text-xs ${darkMode ? "text-slate-300" : "text-slate-600"}`}>{excerpt(replyTo)}</div>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className={`rounded-lg px-2 py-1 text-[11px] ${darkMode ? "text-slate-400 hover:bg-white/[0.06]" : "text-slate-500 hover:bg-slate-900/[0.04]"}`}>
                  Annuler
                </button>
              </div>
            </div>
          ) : null}

          {pendingImage ? (
            <div className={`rounded-lg p-2 ${darkMode ? "bg-white/[0.05]" : "bg-black/[0.03]"}`}>
              <div className={`flex items-center justify-between px-1 pb-2 text-xs ${darkMode ? "text-slate-500" : "text-slate-500"}`}>
                <span>{pendingImageName || "Pièce jointe"}</span>
                <button type="button" onClick={clearPendingImage} className={`rounded-lg px-2 py-0.5 text-[11px] ${darkMode ? "text-slate-400 hover:bg-white/[0.06]" : "text-slate-600 hover:bg-slate-900/[0.04]"}`}>
                  Retirer
                </button>
              </div>
              <button type="button" onClick={() => setImageZoomUrl(pendingImage)} className="block w-full">
                <img src={pendingImage} alt="Apercu" className="h-24 w-full rounded-lg object-cover ring-1 ring-black/5" />
              </button>
              {imageSendProgress > 0 && imageSendProgress < 100 ? (
                <div className={`mt-2 h-1 w-full overflow-hidden rounded-full ${darkMode ? "bg-white/[0.08]" : "bg-slate-200/70"}`}>
                  <div className="h-full rounded-full bg-[#4a9b86] transition-all duration-300" style={{ width: `${imageSendProgress}%` }} />
                </div>
              ) : null}
            </div>
          ) : null}
            </div>
          </div>

          <div
            className={`shrink-0 border-t backdrop-blur-md ${
              darkMode ? "border-white/[0.06] bg-[#0e1218]/65" : "border-slate-900/[0.05] bg-white/50"
            }`}
          >
            <div className="mx-auto w-full max-w-[min(100%,820px)] px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 min-[1200px]:max-w-[min(100%,880px)] min-[1200px]:px-5 min-[1400px]:max-w-[min(100%,940px)] min-[1600px]:max-w-[min(100%,1000px)]">
              <ChatComposer
                input={input}
                sending={sending}
                canSend={Boolean(agentId) && (!!input.trim() || !!pendingImage)}
                hasAttachment={Boolean(pendingImage)}
                recordingVoice={recordingVoice}
                darkMode={darkMode}
                onAttach={() => fileRef.current?.click()}
                onInputChange={setInput}
                onSend={send}
                onVoiceToggle={toggleVoiceRecording}
                onInputFocus={() => {
                  window.requestAnimationFrame(() => {
                    scrollThreadToBottom("smooth");
                  });
                }}
              />
            </div>
          </div>
          </div>
          {imageZoomUrl ? (
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 px-4 backdrop-blur-sm" onClick={() => setImageZoomUrl(null)}>
              <motion.img
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                src={imageZoomUrl}
                alt="Aperçu zoom"
                className="max-h-[82vh] w-auto max-w-[92vw] rounded-2xl border border-white/20 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : null}
        </motion.div>
        <ChatInsightsPanel
          businessName={sanitizeUiLabel(agentName)}
          agentName={humanAgent.name}
          agentAvatarUrl={agentAvatarUrl}
          status={presenceStatus}
          messages={visibleMessages.map((m) => ({ role: m.role, content: m.content, ts: m.ts }))}
          darkMode={darkMode}
        />
        </div>
      </div>
      <ChatClearModal
        open={showClearModal}
        darkMode={darkMode}
        onCancel={() => setShowClearModal(false)}
        onConfirm={clearConversationUi}
      />
    </motion.div>
  );
}
