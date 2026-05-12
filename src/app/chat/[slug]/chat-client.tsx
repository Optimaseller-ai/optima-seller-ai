"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, Reply, Smile, Trash2 } from "lucide-react";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { ChatInsightsPanel } from "./chat-insights-panel";
import { ChatSidebar } from "./chat-sidebar";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";
import {
  COMMERCIAL_AGENTS,
  getCommercialAgentById,
  pickRandomCommercialAgent,
  type CommercialAgentDef,
  type CommercialAgentPublic,
} from "@/lib/chat/commercial-agents";
import type { ProspectTone, SellerBehaviorConversationState } from "@/lib/chat/seller-behavior-types";

type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
  kind?: "text" | "image";
  image_data_url?: string;
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

function detectDominantLanguage(args: { message: string; previous?: "fr" | "en" }): "fr" | "en" {
  const msg = String(args.message ?? "").trim().toLowerCase();
  if (!msg) return args.previous ?? "fr";
  if (/\b(hello|hi|hey|good morning|good evening|good afternoon|how much|how much is|price|available|in stock|delivery|pay|payment)\b/i.test(msg)) return "en";
  if (/\b(bonjour|bonsoir|svp|s'il vous plaît|s il vous plait|combien|prix|disponible|livraison|payer|paiement)\b/i.test(msg)) return "fr";

  const en = msg.match(/\b(the|a|an|and|or|with|for|to|from|of|in|on|at|is|are|we|you|your|sir|madam|please|thanks|thank)\b/gi)?.length ?? 0;
  const fr = msg.match(/\b(le|la|les|un|une|des|et|ou|avec|pour|de|du|dans|sur|chez|est|sont|nous|vous|votre|monsieur|madame|s'il|merci)\b/gi)?.length ?? 0;
  if (en === fr) return args.previous ?? "fr";
  return en > fr ? "en" : "fr";
}

function computeReadDelayMs(args: { userMessage: string; fatigue01: number; profileTone?: ProspectTone }) {
  const msg = String(args.userMessage ?? "");
  const len = msg.trim().length;
  const rushed = detectRushedUserMessage(msg);
  const talkative = detectTalkativeUserMessage(msg);
  const h = new Date().getHours();
  const bucket = hourBucket(h);

  const complexity =
    len > 80 ||
    /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(
      msg,
    );

  // Délai « lecture » avant statut vu : simple ~2–5 s, complexe plus long, jamais instantané.
  const min = complexity ? 4500 : 2000;
  const max = complexity ? 16_000 : 5500;
  const f = clamp(0, args.fatigue01, 1);

  const base = min + Math.round(Math.random() * Math.max(0, max - min));
  const byTalkative = talkative ? 450 : 0;
  const byTime = bucket === "night" ? 900 : bucket === "evening" ? 450 : 0;
  const byFatigue = Math.round(500 * f);
  const byRushed = rushed ? -900 : 0;
  const hesitant = args.profileTone === "hesitant" ? 900 + Math.round(Math.random() * 2400) : 0;
  const aggressive = args.profileTone === "aggressive" ? 350 + Math.round(Math.random() * 500) : 0;

  return clamp(min, base + byTalkative + byTime + byFatigue + byRushed + hesitant + aggressive, complexity ? 18_000 : 8000);
}

function computeThinkDelayMs(userMessage: string, opts?: { profileTone?: ProspectTone }) {
  const m = String(userMessage ?? "").toLowerCase();
  const complex =
    m.length > 80 ||
    /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(m);
  const veryShort = m.trim().length <= 14;
  const base = complex ? 5200 + Math.round(Math.random() * 6800) : 1600 + Math.round(Math.random() * 2800);
  const shortCut = veryShort ? 400 + Math.round(Math.random() * 500) : 0;
  const hesitant = opts?.profileTone === "hesitant" ? 1200 + Math.round(Math.random() * 3200) : 0;
  return clamp(1200, base + hesitant - shortCut, complex ? 20_000 : 7200);
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
  const nightSlow = bucket === "night" ? 900 + Math.round(Math.random() * 1400) : bucket === "evening" ? 400 + Math.round(Math.random() * 700) : 0;
  let base: number;
  if (len < 90) base = 2800 + Math.round(Math.random() * 4200);
  else if (len < 240) base = 3600 + Math.round(Math.random() * 4000);
  else base = 4800 + Math.round(Math.random() * 3800);

  if (args.rushed) base = Math.max(2600, Math.round(base * 0.82));
  const f = clamp(0, args.fatigue01, 1);
  const fatigueAdd = Math.round(600 * f);
  const jitter = Math.round(Math.random() * 400);
  const hesitant = args.profileTone === "hesitant" ? 500 + Math.round(Math.random() * 900) : 0;
  return clamp(2600, base + fatigueAdd + jitter + nightSlow + hesitant, 14_000);
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

function pickClientHoldReply(lang: "fr" | "en"): string {
  const fr = ["Je regarde cela.", "Un instant s'il vous plaît.", "Je vérifie."];
  const en = ["Just a moment.", "Let me check that.", "One moment please."];
  const xs = lang === "en" ? en : fr;
  return xs[Math.floor(Math.random() * xs.length)]!;
}

function pickServiceInterlude(args: { lang: "fr" | "en"; style: "direct" | "reassuring" }) {
  if (args.lang === "en") {
    const direct = ["One moment.", "Let me check.", "Alright, checking now."];
    const reassuring = ["One moment please.", "I’m checking that for you.", "Thanks for your patience."];
    const xs = args.style === "reassuring" ? reassuring : direct;
    return xs[Math.floor(Math.random() * xs.length)]!;
  }
  const direct = ["Un instant.", "Je vérifie.", "Très bien, je regarde."];
  const reassuring = ["Un instant, je vérifie pour vous.", "Je regarde cela avec attention.", "Merci pour votre patience."];
  const xs = args.style === "reassuring" ? reassuring : direct;
  return xs[Math.floor(Math.random() * xs.length)]!;
}

function uiLangFromConversationState(state: unknown): "fr" | "en" {
  if (state && typeof state === "object" && (state as { language?: string }).language === "en") return "en";
  return "fr";
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
      .map((m) => ({ role: m.role, content: String(m.content), ts: String(m.ts) }));

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
      messages: cleanedMessages,
      agent_name: agentName,
      agent_personality: agentPersonality,
      sales_style: salesStyle,
      created_at: createdAt,
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
      return merged;
    }
    return existing;
  }
  const next = createFreshSession(slug, persona);
  saveSession(slug, next);
  return next;
}

function toUiMessages(messages: StoredMessage[]): UiMessage[] {
  return messages.map((m) => ({ ...m, id: crypto.randomUUID() }));
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
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<UiMessage | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string>("");
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
  const lastAssistantCountRef = useRef(0);
  const [conversationPreviews, setConversationPreviews] = useState<ConversationPreview[]>([]);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("optima_chat_unread_map_v1");
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [soundsOn, setSoundsOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("optima_chat_sounds") === "1";
    } catch {
      return false;
    }
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (!el) return;
    const top = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTo({ top, behavior });
  }, []);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inFlightRef = useRef(false);
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

  const accent = useMemo(() => {
    const from = String((humanAgent as any).accentFrom ?? "").trim();
    const to = String((humanAgent as any).accentTo ?? "").trim();
    if (from && to) return { from, to };
    return { from: "rgba(74,155,134,0.92)", to: "rgba(196,138,76,0.68)" };
  }, [(humanAgent as any).accentFrom, (humanAgent as any).accentTo]);

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

  useEffect(() => {
    setMounted(true);
    if (!storedSession) return;
    setMessages(toUiMessages(storedSession.messages));
    setUnreadMap((prev) => ({ ...prev, [slug]: 0 }));
    setUnseenCount(0);
  }, [storedSession]);

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
    try {
      window.localStorage.setItem("optima_chat_sounds", soundsOn ? "1" : "0");
    } catch {
      // ignore
    }
  }, [soundsOn]);

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
    const state = storedSession.conversation_state ?? {};
    const introDone = Boolean((state as any).intro_done);
    if (introDone) return;
    if (storedSession.messages.length > 0) return;

    (async () => {
      try {
        // Mark intro as done immediately to avoid double-firing on refresh.
        const nextState = { ...(state as any), intro_done: true, stats: { ...(state as any).stats, last_active_at: Date.now() } };
        saveSession(slug, { ...storedSession, conversation_state: nextState });

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
      if (!res.ok) return;
      const data = (await res.json().catch(() => null)) as any;
      if (cancelled) return;
      if (data?.agent?.id) setAgentId(String(data.agent.id));

      const persona = (data?.persona as CommercialAgentPublic | undefined) ?? lockedPersona ?? null;
      if (persona) {
        const merged = getOrCreateSession(slug, persona);
        const srv = Array.isArray(data.messages) ? (data.messages as StoredMessage[]) : [];
        if (srv.length > merged.messages.length) {
          const nextSession: StoredChatSession = {
            ...merged,
            messages: srv.slice(-MAX_STORED_MESSAGES),
          };
          saveSession(slug, nextSession);
          setLocalSessionTick((x) => x + 1);
          setMessages(toUiMessages(nextSession.messages));
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
          let next = prev;
          for (const sm of toAdd) {
            next = next.concat({
              id: crypto.randomUUID(),
              role: "assistant",
              content: sm.content,
              ts: sm.ts,
              animateIn: "left",
            });
          }
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
      return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
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
	    const sess = storedSessionRef.current;
	    if (!sess) return;
	    const persisted: StoredMessage[] = ui
	      .filter((m) => !m.typing)
	      .slice(-MAX_STORED_MESSAGES)
	      .map((m) => ({
	        role: m.role,
	        content: m.content,
	        ts: m.ts,
	        kind: m.kind,
	        image_data_url: m.image_data_url,
	        reply_to_id: m.reply_to_id,
	        reactions: m.reactions,
	        delivered_at: m.delivered_at,
	        read_at: m.read_at,
	      }));
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
      state.language = detectDominantLanguage({ message: userMessage, previous: state.language });
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

      // Save back
      saveSession(slug, { ...storedSession, conversation_state: state });
    } catch (e) {
      console.error("[CHAT] updateConversationStateWithUserMessage error", e);
    }
  }

  function splitIntoBubbles(reply: string, opts: { rushed: boolean; fatigue01: number }) {
    const raw = String(reply ?? "").trim();
    if (!raw) return [];
    if (opts.rushed) return [raw];

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

    // Further split very long chunks to feel like multiple short WhatsApp messages.
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
    const maxBubbles = len < 120 ? 2 : len < 240 ? 3 : len < 520 ? 5 : 6;
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

    return items;
  }

  async function emitAssistantBubbles(args: { bubbles: string[]; baseTsIso: string }) {
    for (let i = 0; i < args.bubbles.length; i++) {
      const bubble = args.bubbles[i]!;
      const assistantId = crypto.randomUUID();
      setMessages((prev) => {
        const next = prev.concat({ id: assistantId, role: "assistant", content: bubble, ts: new Date().toISOString(), animateIn: "left" });
        persistFromUi(next);
        return next;
      });
      playIncomingTick();
      triggerMobileHaptic(12);
      if (i < args.bubbles.length - 1) {
        // Human cadence between multiple short messages (WhatsApp-like).
        const byLen = bubble.length > 120 ? 420 : bubble.length > 70 ? 240 : 120;
        const gap = 420 + byLen + Math.round(Math.random() * 1050);
        await sleep(gap);
      }
    }
  }

	  async function send() {
	    const message = input.trim();
	    const hasImage = !!pendingImage;
	    if ((!message && !hasImage) || !agentId || sending || inFlightRef.current) return;

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
	          kind: localImage ? "image" : "text",
	          image_data_url: localImage ?? undefined,
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
    const profileTone = storedSessionRef.current?.conversation_state?.conversationProfile?.tone;

    function setTypingVisible(visible: boolean) {
      setMessages((prev) => {
        const has = prev.some((m) => m.id === typingId);
        if (visible && has) return prev;
        if (!visible && !has) return prev;
        const next = visible
          ? [
              ...prev,
              { id: typingId, role: "assistant", content: "typing", ts: new Date().toISOString(), typing: true, animateIn: "left" },
            ]
          : prev.filter((x) => x.id !== typingId);
        persistFromUi(next);
        return next;
      });
    }

    try {
      console.log("[CHAT] Envoi du message à /api/chat/send...", { message, agentId });
      const startTime = Date.now();
      
      // Human read + think + typing are independent from backend latency.
      const readDelay = computeReadDelayMs({ userMessage: message, fatigue01, profileTone });
      const thinkDelay = computeThinkDelayMs(message, { profileTone });
      const pauseAfterRead = 280 + Math.round(Math.random() * 750); // small "processing" pause after "vu"
      const minTypingBeforeReply = 1200 + Math.round(Math.random() * 1200);

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

      const clientCtl = new AbortController();
      const clientAbortTimer = window.setTimeout(() => clientCtl.abort(), 70_000);
      const responsePromise = fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: clientCtl.signal,
        body: JSON.stringify({
	          message: message || (localImage ? `📷 ${localImageName || "Image"}` : ""),
          agent_id: agentId,
          session_id: sessionId,
          agent_name: humanAgent.name,
          agent_personality: humanAgent.personality,
          business_name: agentName,
          sales_style: humanAgent.salesStyle,
	          history: messages
	            .filter((m) => !m.typing)
	            .slice(-12)
	            .map((m) => ({ role: m.role, content: m.kind === "image" ? `[image] ${m.content || ""}`.trim() : m.content })),
	          conversation_state: storedSession?.conversation_state ?? undefined,
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
      await sleep(pauseAfterRead);
      setAgentPresencePhase("thinking");
      await sleep(thinkDelay);

      setReadReceiptMessageId(null);
      setAgentPresencePhase("writing");

      // Premium human behavior: rare "service interlude" before the real reply.
      // Keeps the experience business-like (concierge / premium support) without exposing automation.
      if (!rushed) {
        const msgLen = message.trim().length;
        const complex =
          msgLen > 90 ||
          /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(
            message,
          );
        const style = humanAgent.personality === "chaleureux" ? ("reassuring" as const) : ("direct" as const);
        const chance = complex ? 0.32 : msgLen < 18 ? 0.08 : 0.14;
        if (Math.random() < chance) {
          const langUi = uiLangFromConversationState(storedSession?.conversation_state);
          const b1 = pickServiceInterlude({ lang: langUi, style });
          await emitAssistantBubbles({ bubbles: [b1], baseTsIso: new Date().toISOString() });
          await sleep(520 + Math.round(Math.random() * 1100));
          if (complex && style === "reassuring" && Math.random() < 0.22) {
            const b2 = pickServiceInterlude({ lang: langUi, style });
            if (b2 !== b1) await emitAssistantBubbles({ bubbles: [b2], baseTsIso: new Date().toISOString() });
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
      const allowInterrupts = !rushed && Math.random() < 0.78;
      const interruptChance = allowInterrupts ? 0.22 + 0.25 * fatigue01 : 0.0;

      let res: Response | null = null;
      while (!res) {
        // Wait a small step; if backend already answered, break.
        const step = 420 + Math.round(Math.random() * 520);
        const maybe = await Promise.race([responsePromise.then((r) => ({ done: true as const, r })), sleep(step).then(() => ({ done: false as const }))]);
        if (maybe.done) {
          res = maybe.r;
          break;
        }

        if (allowInterrupts && Date.now() - typingStartAt > 1000 && Math.random() < interruptChance) {
          // Micro-interruption: typing stops briefly, then resumes.
          setTypingVisible(false);
          await sleep(260 + Math.round(Math.random() * 780));
          setTypingVisible(true);
          typingVisibleAt = Date.now();
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
      });

      const langUi = uiLangFromConversationState(storedSession?.conversation_state);
      let reply: string;
      const trimmedReply = typeof data?.reply === "string" ? String(data.reply).trim() : "";
      if (trimmedReply.length > 0) {
        reply = trimmedReply;
        if (!res.ok || data?.error) {
          console.warn("[CHAT] Réponse affichée malgré indication serveur", { status: res.status, error: data?.error });
        }
        console.log("[CHAT] Réponse IA:", reply);
      } else {
        console.error("[CHAT] Pas de réponse exploitable", { status: res.status, error: data?.error });
        await ensureMinTypingPauseBeforeFallback(Date.now() - typingVisibleAt);
        reply = pickClientHoldReply(langUi);
      }

	      console.log("message reçu", message);
	      console.log("agent_id", agentId);
	      console.log("réponse IA", reply);

	      setMessages((prev) => {
	        const next = prev.map((m) => (m.id === userMessageId ? { ...m, status: "sent" as const } : m));
	        persistFromUi(next);
	        return next;
	      });

      // Keep typing visible long enough to avoid "robot instant answers".
      const typingMode = reply.length <= 90 ? "short" : reply.length <= 260 ? "sales" : "long";
      const desiredTyping = computeTypingDurationMs({ reply, mode: typingMode, fatigue01, rushed, profileTone });
      const elapsedTyping = Date.now() - typingVisibleAt;
      const remainingTyping = Math.max(0, Math.max(minTypingBeforeReply, desiredTyping) - elapsedTyping);
      if (remainingTyping) await sleep(remainingTyping);

      const bubbles = splitIntoBubbles(reply, { rushed, fatigue01 });
      setTypingVisible(false);
      await emitAssistantBubbles({ bubbles, baseTsIso: new Date().toISOString() });
      if (data?.conversation_state && typeof data.conversation_state === "object") {
        const cur = storedSessionRef.current;
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
      console.error("[OPTIMA_AI_ERROR]", err);
      const langUi = uiLangFromConversationState(storedSession?.conversation_state);
      const elapsedTyping =
        typingStartedAtRef.current != null ? Date.now() - typingStartedAtRef.current : Date.now() - startedAt;
      await ensureMinTypingPauseBeforeFallback(elapsedTyping);
      const reply = pickClientHoldReply(langUi);
      setTypingVisible(false);
      await emitAssistantBubbles({ bubbles: [reply], baseTsIso: new Date().toISOString() });
      setReadReceiptMessageId(null);
    } finally {
      setAgentPresencePhase("default");
      setSending(false);
      inFlightRef.current = false;
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const isTyping = messages.some((m) => m.typing);
  const visibleMessages = messages.filter((m) => !m.typing);
  const query = search.trim().toLowerCase();
  const displayedMessages = query
    ? visibleMessages.filter((m) => String(m.content ?? "").toLowerCase().includes(query))
    : visibleMessages;
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

  return (
    <div className={`optima-chat-shell h-dvh overflow-hidden ${darkMode ? "bg-[#0a0d11]" : ""}`} style={accentStyle}>
      <div className="mx-auto grid h-dvh w-full max-w-[2200px] grid-cols-1 lg:p-3 min-[1400px]:p-4">
        <div
          className={`grid h-full w-full grid-cols-1 overflow-hidden transition-[grid-template-columns,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)] min-[1200px]:grid-cols-[minmax(0,11.75rem)_minmax(0,1fr)_minmax(0,11.75rem)] min-[1400px]:grid-cols-[minmax(0,12.25rem)_minmax(0,1fr)_minmax(0,12.25rem)] min-[1600px]:grid-cols-[minmax(0,12.75rem)_minmax(0,1fr)_minmax(0,12.75rem)] lg:rounded-xl lg:shadow-[0_1px_40px_rgba(15,23,42,0.04)] lg:ring-1 ${
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
          className={`cinema-center relative min-w-0 flex h-full flex-1 flex-col overflow-hidden rounded-none backdrop-blur-[18px] ${
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
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }} className="relative z-[1] flex w-full flex-col gap-5 pb-8">
              {visibleMessages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: [0, -2, 0] }}
                  transition={{ duration: 2.9, repeat: Number.POSITIVE_INFINITY, repeatType: "mirror" }}
                  className={`rounded-xl px-6 py-8 text-center ${darkMode ? "bg-white/[0.04]" : "bg-white/40"}`}
                >
                  <div className={`mx-auto mb-4 h-14 w-14 overflow-hidden rounded-full ring-1 ${darkMode ? "ring-white/10" : "ring-black/[0.05]"}`}>
                    {avatarOk ? <img src={agentAvatarUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <p className={`text-[17px] font-semibold tracking-tight ${darkMode ? "text-slate-100" : "text-slate-900"}`}>
                    Bienvenue chez {sanitizeUiLabel(agentName)}
                  </p>
                  <p className={`mt-2 text-sm leading-relaxed ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {humanAgent.name} vous répond en quelques minutes — même esprit qu’une conversation WhatsApp pro.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {["J’ai une question sur un produit", "Je cherche un prix", "Besoin d’un conseil"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          darkMode
                            ? "bg-white/[0.06] text-slate-300 hover:bg-white/[0.1]"
                            : "bg-slate-900/[0.05] text-slate-700 hover:bg-slate-900/[0.08]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}

              {visibleMessages.length === 0 && !agentId ? (
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
                // Smart message grouping (iMessage / WhatsApp desktop feel).
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
              {isTyping || agentPresencePhase === "thinking" ? (
                <TypingIndicator
                  name={humanAgent.name}
                  avatarUrl={agentAvatarUrl}
                  avatarOk={avatarOk}
                  initials={initials(humanAgent.name)}
                  phase={agentPresencePhase === "writing" || isTyping ? "writing" : "thinking"}
                  subtitle={presenceDetail || undefined}
                  darkMode={darkMode}
                />
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
                darkMode={darkMode}
                onAttach={() => fileRef.current?.click()}
                onInputChange={setInput}
                onSend={send}
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
    </div>
  );
}
