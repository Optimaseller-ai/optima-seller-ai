"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChatDebugPanel } from "@/components/debug/chat-debug-panel";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { ChatSidebar } from "./chat-sidebar";
import { MessageBubble } from "./message-bubble";
import { TypingIndicator } from "./typing-indicator";

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
};

type StoredChatSession = {
  messages: StoredMessage[];
  agent_name: string;
  agent_personality: HumanAgentPersonality;
  sales_style: SalesStyle;
  created_at: number;
  conversation_state?: {
    language?: "fr" | "en";
    agent_profile?: HumanAgentProfile;
    preferences?: { blacklist?: string[] };
    mood?: string;
    memory?: string[];
    tone_mode?: "chill" | "premium" | "vendeur_soft" | "support_client" | "conversation_naturelle";
    stats?: {
      turn_count?: number;
      fatigue?: number; // 0..1
      last_active_at?: number;
    };
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
    if (dayDiff === 0) return "Aujourd’hui";
    if (dayDiff === -1) return "Hier";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
  } catch {
    return "";
  }
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-navy)]/35 [animation:typingDot_1s_infinite] [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-navy)]/35 [animation:typingDot_1s_infinite] [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-navy)]/35 [animation:typingDot_1s_infinite]" />
    </span>
  );
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

function generateHumanAgentProfile(): HumanAgentProfile {
  const profiles: HumanAgentProfile[] = [
    // Prefer local portraits if you add them later under /public/agents/*.jpg.
    // For now, we use deterministic realistic portraits (remote) to avoid "cartoon AI avatars".
    {
      id: "sarah",
      name: "Sarah",
      gender: "f",
      avatar: "https://randomuser.me/api/portraits/women/44.jpg",
      accent: { from: "rgba(59,130,246,0.95)", to: "rgba(22,163,74,0.85)" },
      personality: "chaleureux",
      salesStyle: "premium",
    },
    {
      id: "vanessa",
      name: "Vanessa",
      gender: "f",
      avatar: "https://randomuser.me/api/portraits/women/68.jpg",
      accent: { from: "rgba(251,191,36,0.95)", to: "rgba(22,163,74,0.82)" },
      personality: "professionnel",
      salesStyle: "premium",
    },
    {
      id: "mireille",
      name: "Mireille",
      gender: "f",
      avatar: "https://randomuser.me/api/portraits/women/32.jpg",
      accent: { from: "rgba(139,92,246,0.92)", to: "rgba(59,130,246,0.78)" },
      personality: "professionnel",
      salesStyle: "conseiller",
    },
    {
      id: "grace",
      name: "Grâce",
      gender: "f",
      avatar: "https://randomuser.me/api/portraits/women/19.jpg",
      accent: { from: "rgba(22,163,74,0.95)", to: "rgba(59,130,246,0.75)" },
      personality: "chaleureux",
      salesStyle: "conseiller",
    },
    {
      id: "cynthia",
      name: "Cynthia",
      gender: "f",
      avatar: "https://randomuser.me/api/portraits/women/6.jpg",
      accent: { from: "rgba(59,130,246,0.95)", to: "rgba(251,191,36,0.78)" },
      personality: "dynamique",
      salesStyle: "closer",
    },
    {
      id: "nadia",
      name: "Nadia",
      gender: "f",
      avatar: "https://randomuser.me/api/portraits/women/53.jpg",
      accent: { from: "rgba(22,163,74,0.92)", to: "rgba(251,191,36,0.78)" },
      personality: "chaleureux",
      salesStyle: "premium",
    },
    {
      id: "lucas",
      name: "Lucas",
      gender: "m",
      avatar: "https://randomuser.me/api/portraits/men/46.jpg",
      accent: { from: "rgba(59,130,246,0.92)", to: "rgba(139,92,246,0.82)" },
      personality: "professionnel",
      salesStyle: "premium",
    },
    {
      id: "jordan",
      name: "Jordan",
      gender: "m",
      avatar: "https://randomuser.me/api/portraits/men/14.jpg",
      accent: { from: "rgba(251,191,36,0.95)", to: "rgba(59,130,246,0.78)" },
      personality: "dynamique",
      salesStyle: "closer",
    },
    {
      id: "axel",
      name: "Axel",
      gender: "m",
      avatar: "https://randomuser.me/api/portraits/men/28.jpg",
      accent: { from: "rgba(22,163,74,0.95)", to: "rgba(139,92,246,0.78)" },
      personality: "professionnel",
      salesStyle: "closer",
    },
    {
      id: "kevin",
      name: "Kevin",
      gender: "m",
      avatar: "https://randomuser.me/api/portraits/men/33.jpg",
      accent: { from: "rgba(59,130,246,0.92)", to: "rgba(22,163,74,0.78)" },
      personality: "dynamique",
      salesStyle: "closer",
    },
    {
      id: "lionel",
      name: "Lionel",
      gender: "m",
      avatar: "https://randomuser.me/api/portraits/men/62.jpg",
      accent: { from: "rgba(139,92,246,0.92)", to: "rgba(251,191,36,0.78)" },
      personality: "professionnel",
      salesStyle: "premium",
    },
    {
      id: "emmanuel",
      name: "Emmanuel",
      gender: "m",
      avatar: "https://randomuser.me/api/portraits/men/8.jpg",
      accent: { from: "rgba(22,163,74,0.95)", to: "rgba(59,130,246,0.78)" },
      personality: "chaleureux",
      salesStyle: "conseiller",
    },
  ];
  return profiles[Math.floor(Math.random() * profiles.length)];
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

function computeReadDelayMs(args: { userMessage: string; fatigue01: number }) {
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

  // Spec: 4–8s “vu” timing (still human-looking).
  // Keep variations inside that range: complexity/night/fatigue skew higher.
  const min = 4000;
  const max = 10_000;
  const f = clamp(0, args.fatigue01, 1);

  const base = min + Math.round(Math.random() * (max - min)); // 4-10s
  const byComplexity = complexity ? 650 : 0;
  const byTalkative = talkative ? 450 : 0;
  const byTime = bucket === "night" ? 500 : bucket === "evening" ? 220 : 0;
  const byFatigue = Math.round(700 * f);
  const byRushed = rushed ? -750 : 0; // still clamps >= 4s

  return clamp(min, base + byComplexity + byTalkative + byTime + byFatigue + byRushed, max);
}

function computeThinkDelayMs(userMessage: string) {
  // Time between "Lu" and "is typing..."
  // We add a bit of delay when the prospect message is complex (feels less "instant").
  // Delay before showing typing indicator (after "Vu").
  // Target: short msg ~3s, long msg ~5s.
  const base = 2400 + Math.round(Math.random() * 900); // 2.4-3.3s
  const m = String(userMessage ?? "").toLowerCase();
  const complex =
    m.length > 80 ||
    /(comment|pourquoi|livraison|adresse|paiement|payer|garantie|retour|échange|remboursement|taille|couleur|disponible|stock|compar|moins cher|budget|max)/i.test(m);
  const add = complex ? 1400 + Math.round(Math.random() * 700) : 0; // +1.4-2.1s
  return base + add;
}

function computeTypingDurationMs(args: { reply: string; mode: "short" | "sales" | "long"; fatigue01: number; rushed: boolean }) {
  // Spec: small 8s, medium ~12s, long 15–20s.
  const len = String(args.reply ?? "").trim().length;
  
  let base: number;
  if (len < 90) base = 8000 + Math.round(Math.random() * 1600); // 8.0-9.6s
  else if (len < 240) base = 11000 + Math.round(Math.random() * 2200); // 11.0-13.2s
  else base = 15000 + Math.round(Math.random() * 5000); // 15-20s

  // Rushed prospects: do not exceed too much, but keep human baseline (no insta).
  if (args.rushed) base = Math.max(8000, Math.round(base * 0.78));

  // Fatigue slightly slows down (still within a reasonable human range).
  const f = clamp(0, args.fatigue01, 1);
  const fatigueAdd = Math.round(900 * f);
  const jitter = Math.round(Math.random() * 420);

  return clamp(8000, base + fatigueAdd + jitter, 22_000);
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

function createFreshSession(slug: string): StoredChatSession {
  const profile = generateHumanAgentProfile();
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

function getOrCreateSession(slug: string): StoredChatSession {
  const existing = loadSession(slug);
  if (existing) return existing;
  const next = createFreshSession(slug);
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

function avatarUrlForSeed(seed: string) {
  const s = encodeURIComponent(String(seed ?? "").trim() || "agent");
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${s}`;
}

const PROFESSIONAL_AGENT_AVATAR =
  "https://images.unsplash.com/photo-1573496799652-408c2ac9fe98?auto=format&fit=crop&w=320&q=80";

function triggerMobileHaptic(pattern: number | number[]) {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    if (!window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches) return;
    (navigator as any).vibrate?.(pattern);
  } catch {
    // ignore haptics on unsupported devices
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function getOfficeHoursLabel(now = new Date()) {
  const h = now.getHours();
  // Heuristic: 08:00–22:30 "online", otherwise soften expectations.
  const isBusiness = h >= 8 && h <= 22;
  if (isBusiness) return { status: "En ligne", hint: "Réponse rapide" };
  if (h >= 23 || h <= 5) return { status: "Hors ligne", hint: "Répond généralement le matin" };
  return { status: "En ligne", hint: "Répond dans la journée" };
}

function contextualStatus(args: { lastUserMessage: string; officeStatus: "En ligne" | "Hors ligne" }) {
  const m = String(args.lastUserMessage ?? "").toLowerCase();
  if (args.officeStatus === "Hors ligne") return "Répond généralement le matin";
  if (!m) return "En ligne";
  if (/\b(prix|combien|tarif)\b/i.test(m)) return "Je vérifie le prix…";
  if (/\b(dispo|disponible|stock)\b/i.test(m)) return "Je vérifie le stock…";
  if (/\b(taille|size)\b/i.test(m)) return "Je vérifie les tailles…";
  if (/\b(couleur|coloris)\b/i.test(m)) return "Je vérifie les couleurs…";
  if (/\b(livraison|adresse|où|ou)\b/i.test(m)) return "Je regarde la livraison…";
  if (/\b(payer|paiement|payment|checkout)\b/i.test(m)) return "Je vous guide pour payer…";
  if (/\b(urgent|vite|maintenant)\b/i.test(m)) return "Je vous réponds…";
  return "Je vous réponds…";
}

export default function ChatClient({ slug, agentName }: { slug: string; agentName: string }) {
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
  const [unseenCount, setUnseenCount] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const t = window.localStorage.getItem("optima_chat_theme");
      return t === "light" || t === "dark" || t === "system" ? t : "dark";
    } catch {
      return "dark";
    }
  });
  const [wallpaper, setWallpaper] = useState<"dots" | "paper" | "mesh" | "plain">(() => {
    if (typeof window === "undefined") return "dots";
    try {
      const w = window.localStorage.getItem("optima_chat_wallpaper");
      return w === "dots" || w === "paper" || w === "mesh" || w === "plain" ? (w as any) : "dots";
    } catch {
      return "dots";
    }
  });
  const [avatarOk, setAvatarOk] = useState(true);
  const [menuForId, setMenuForId] = useState<string | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const swipeRef = useRef<{ id: string; startX: number; startY: number; active: boolean } | null>(null);
  const [imageSendProgress, setImageSendProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [livePulse, setLivePulse] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const backSwipeRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const inFlightRef = useRef(false);
  const typingStartedAtRef = useRef<number | null>(null);
  const readTimerFiredRef = useRef(false);
  const timeoutsRef = useRef<number[]>([]);

  const sessionId = useMemo(() => (typeof window === "undefined" ? "" : getOrCreateSessionId()), []);
  const storedSession = useMemo(() => (typeof window === "undefined" ? null : getOrCreateSession(slug)), [slug]);
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
    return { from: "rgba(22,163,74,0.95)", to: "rgba(22,163,74,0.70)" };
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
    const stored = String(humanAgent.avatar ?? "").trim();
    if (stored.startsWith("/agents/")) return stored;
    // Force a more professional and consistent portrait for premium UI.
    return PROFESSIONAL_AGENT_AVATAR;
  }, [slug, humanAgent.name, (humanAgent as any).avatar]);

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
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    root.setAttribute("data-wallpaper", wallpaper);
    try {
      window.localStorage.setItem("optima_chat_theme", theme);
      window.localStorage.setItem("optima_chat_wallpaper", wallpaper);
    } catch {
      // ignore
    }
  }, [theme, wallpaper]);

  useEffect(() => {
    return () => {
      for (const t of timeoutsRef.current) window.clearTimeout(t);
      timeoutsRef.current = [];
      if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    };
  }, []);

  function statusLabel(status: UiMessage["status"]) {
    if (!status) return "";
    if (status === "sending") return "…";
    if (status === "sent") return "✓";
    if (status === "delivered") return "✓✓";
    if (status === "read") return "✓✓";
    return "";
  }

  function statusClass(status: UiMessage["status"]) {
    if (!status) return "";
    if (status === "read") return "text-[rgba(59,130,246,0.95)]";
    return "text-[var(--brand-navy)]/55";
  }

  function highlight(content: string, q: string) {
    const query = String(q ?? "").trim();
    if (!query) return content;
    const re = new RegExp(escapeRegExp(query), "ig");
    const parts = content.split(re);
    const matches = content.match(re);
    if (!matches) return content;
    const out: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) out.push(parts[i]);
      const m = matches[i];
      if (m) {
        out.push(
          <mark
            key={`${i}-${m}`}
            className="rounded-md bg-[rgba(251,191,36,0.35)] px-1 text-[inherit] text-[inherit]"
          >
            {m}
          </mark>,
        );
      }
    }
    return out;
  }

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

  function onMessagePointerDown(m: UiMessage, e: React.PointerEvent) {
    if (e.pointerType === "mouse" && (e as any).button === 2) return;
    setPressingId(m.id);
    swipeRef.current = { id: m.id, startX: e.clientX, startY: e.clientY, active: true };
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = window.setTimeout(() => {
      setMenuForId(m.id);
      setPressingId(null);
      swipeRef.current = null;
    }, 420);
  }

  function onMessagePointerMove(e: React.PointerEvent) {
    const s = swipeRef.current;
    if (!s?.active) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (Math.abs(dy) > 22 && Math.abs(dx) < 26) {
      if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      setPressingId(null);
      swipeRef.current = null;
      return;
    }
    if (dx > 70 && Math.abs(dy) < 26) {
      if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      swipeRef.current = null;
      setPressingId(null);
      setReplyTo(s.id ? messages.find((x) => x.id === s.id) ?? null : null);
    }
  }

  function onMessagePointerUp() {
    if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
    setPressingId(null);
    swipeRef.current = null;
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

  function addReaction(id: string, emoji: string) {
    setMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id) return m;
        const r = { ...(m.reactions ?? {}) };
        r[emoji] = (r[emoji] ?? 0) + 1;
        return { ...m, reactions: r };
      });
      persistFromUi(next);
      return next;
    });
  }

  function deleteMessage(id: string) {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id);
      persistFromUi(next);
      return next;
    });
    setMenuForId(null);
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
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, sessionId]);

  useEffect(() => {
    // Auto-scroll WhatsApp-style (user send, typing, assistant reply).
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages.some((m) => m.typing)]);

	  useEffect(() => {
	    const el = listRef.current;
	    if (!el) return;

	    function computeIsAtBottom() {
	      const b = bottomRef.current;
	      if (!b) return true;
	      // Marge pour ne pas considérer "en bas" tant que le repère n'est pas visible
	      // (l'input fixe en bas occupe une partie de l'écran).
	      const thresholdPx = 140;
	      return b.getBoundingClientRect().top <= window.innerHeight - thresholdPx;
	    }

	    function onScroll() {
	      const isAtBottom = computeIsAtBottom();
	      setAtBottom(isAtBottom);
	      if (isAtBottom) setUnseenCount(0);
	    }

	    el.addEventListener("scroll", onScroll, { passive: true });
	    window.addEventListener("scroll", onScroll, { passive: true });
	    window.addEventListener("resize", onScroll, { passive: true });
	    onScroll();

	    return () => {
	      el.removeEventListener("scroll", onScroll as any);
	      window.removeEventListener("scroll", onScroll as any);
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
	    if (!bottomRef.current) return;
	    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
	    setUnseenCount(0);
	    setAtBottom(true);
	  }

	  async function copyText(text: string) {
	    try {
	      await navigator.clipboard.writeText(text);
	    } catch {
	      // ignore
	    }
	  }

	  function persistFromUi(ui: UiMessage[]) {
	    if (!storedSession) return;
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
	      saveSession(slug, { ...storedSession, messages: persisted });
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
      if (chunk.length <= 165) {
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
          if (p.length <= 165) exploded.push(p);
          else exploded.push(p.slice(0, 165).trim() + "…");
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
    const maxBubbles = len < 120 ? 2 : len < 240 ? 3 : len < 520 ? 4 : 5;
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
      setLivePulse(true);
      window.setTimeout(() => setLivePulse(false), 220);
      playIncomingTick();
      triggerMobileHaptic(12);
      if (i < args.bubbles.length - 1) {
        // Human cadence between multiple short messages (WhatsApp-like).
        const gap = 420 + Math.round(Math.random() * 1250);
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

    const typingId = crypto.randomUUID();
    const startedAt = Date.now();
    const fatigue01 = clamp(0, storedSession?.conversation_state?.stats?.fatigue ?? 0, 1);
    const rushed = detectRushedUserMessage(message);

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
      const readDelay = computeReadDelayMs({ userMessage: message, fatigue01 });
      const thinkDelay = computeThinkDelayMs(message);
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

      const responsePromise = fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
	            .slice(-5)
	            .map((m) => ({ role: m.role, content: m.kind === "image" ? `[image] ${m.content || ""}`.trim() : m.content })),
	          conversation_state: storedSession?.conversation_state ?? undefined,
	        }),
      });

      // Sequence: message received -> delay read -> "vu" -> pause -> typing appears (non-instant) -> micro interruptions -> typing disappears -> reply arrives.
      await sleep(readDelay);
      readTimerFiredRef.current = true;
      setReadReceiptMessageId(userMessageId);
      {
        const now = new Date().toISOString();
        setMessages((prev) => prev.map((m) => (m.id === userMessageId ? { ...m, status: "read" as const, read_at: now } : m)));
      }
      await sleep(pauseAfterRead);
      await sleep(thinkDelay);

      setReadReceiptMessageId(null);
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
        statusCode: res.status
      });
      
      let reply: string;
      if (!res.ok) {
        console.error("[CHAT] Erreur HTTP", res.status);
        reply = `Erreur serveur (${res.status}). Réessaye.`;
      } else if (data?.error) {
        console.error("[CHAT] Erreur API", data.error);
        reply = `Désolé, une petite lenteur. Je reviens.`;
      } else if (typeof data?.reply === "string" && String(data.reply).trim().length > 0) {
        reply = String(data.reply).trim();
        console.log("[CHAT] Réponse IA:", reply);
      } else {
        console.warn("[CHAT] Format invalide", { type: typeof data?.reply, value: data?.reply });
        reply = `Un instant, je regarde ça.`;
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
      const desiredTyping = computeTypingDurationMs({ reply, mode: typingMode, fatigue01, rushed });
      const elapsedTyping = Date.now() - typingVisibleAt;
      const remainingTyping = Math.max(0, Math.max(minTypingBeforeReply, desiredTyping) - elapsedTyping);
      if (remainingTyping) await sleep(remainingTyping);

      const bubbles = splitIntoBubbles(reply, { rushed, fatigue01 });
      setTypingVisible(false);
      await emitAssistantBubbles({ bubbles, baseTsIso: new Date().toISOString() });
      setReadReceiptMessageId(null);
    } catch (err) {
      console.error("[CHAT] send() error", err);
      const reply = "Je rencontre un souci, réessayez dans quelques secondes";
      const delay = computeTypingDurationMs({ reply, mode: "short", fatigue01: clamp(0, storedSession?.conversation_state?.stats?.fatigue ?? 0, 1), rushed: true });
      await sleep(delay);
      setTypingVisible(false);
      await emitAssistantBubbles({ bubbles: [reply], baseTsIso: new Date().toISOString() });
      setReadReceiptMessageId(null);
    } finally {
      setSending(false);
      inFlightRef.current = false;
      window.setTimeout(() => inputRef.current?.focus(), 0);
      setSelectedMessageId(null);
    }
  }

  const isTyping = messages.some((m) => m.typing);
  const visibleMessages = messages.filter((m) => !m.typing);
  const selectedMessage = selectedMessageId ? messages.find((m) => m.id === selectedMessageId) ?? null : null;
  const presenceStatus = isTyping
    ? "Redaction..."
    : readReceiptMessageId
      ? "Consultation du message..."
      : sending
        ? "En ligne"
        : "Repond generalement rapidement";
  return (
    <div className="optima-chat-shell min-h-dvh" style={accentStyle}>
      <div className="mx-auto flex min-h-dvh max-w-7xl gap-0 lg:p-4">
        <ChatSidebar
          businessName={agentName}
          preview={visibleMessages.at(-1)?.content ?? ""}
          unread={unseenCount}
          avatarUrl={agentAvatarUrl}
          avatarOk={avatarOk}
          soundsOn={soundsOn}
          currentSlug={slug}
          conversations={conversationPreviews}
          onOpenConversation={(targetSlug) => {
            setUnreadMap((prev) => ({ ...prev, [targetSlug]: 0 }));
            if (targetSlug === slug) {
              setUnseenCount(0);
              return;
            }
            router.push(`/chat/${targetSlug}`);
          }}
          onToggleSounds={() => setSoundsOn((v) => !v)}
        />
        <div className="flex min-h-dvh flex-1 flex-col overflow-hidden rounded-none border-white/60 bg-white/40 backdrop-blur-xl lg:rounded-[30px] lg:border lg:shadow-[0_28px_90px_rgba(15,23,42,0.12)]">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
          <ChatHeader
            businessName={agentName}
            agentAvatarUrl={agentAvatarUrl}
            avatarOk={avatarOk}
            initials={initials(humanAgent.name)}
            status={presenceStatus}
            search={search}
            onSearchChange={setSearch}
          />

          <main ref={listRef} className="chat-scroll flex-1 overflow-y-auto overscroll-contain px-3 py-5 [touch-action:pan-y] sm:px-5 sm:py-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 pb-24 sm:gap-4">
              {visibleMessages.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[30px] border border-white/60 bg-white/78 p-7 text-center shadow-[0_10px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
                  <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-full border border-emerald-100">
                    {avatarOk ? <img src={agentAvatarUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <p className="text-lg font-semibold text-slate-800">Bonsoir Monsieur. Bienvenue chez {agentName}.</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">Je suis {humanAgent.name}. Je vous ecoute.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {[
                      "Voir les produits",
                      "Demander un prix",
                      "Contacter un conseiller",
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : null}

              {visibleMessages.length === 0 && !agentId ? (
                <div className="space-y-2">
                  <div className="h-12 w-64 rounded-2xl bg-gradient-to-r from-slate-100 via-white to-slate-100 [background-size:200%_100%] [animation:shimmer_1.7s_infinite]" />
                  <div className="ml-auto h-12 w-44 rounded-2xl bg-gradient-to-r from-slate-100 via-white to-slate-100 [background-size:200%_100%] [animation:shimmer_1.7s_infinite] [animation-delay:-0.3s]" />
                </div>
              ) : null}

              {visibleMessages.map((m, idx) => {
                const key = m.id || `${m.ts}-${idx}`;
                const product = m.role === "assistant" ? tryExtractProductCard(m.content ?? "") : null;
                const isLastUser = m.role === "user" && m.id === [...visibleMessages].reverse().find((x) => x.role === "user")?.id;
                return (
                  <div key={key} className="space-y-2">
                    <MessageBubble
                      id={m.id}
                      role={m.role}
                      content={m.content ?? ""}
                      time={formatTime(m.ts)}
                      selected={selectedMessageId === m.id}
                      reactions={m.reactions}
                      showRead={Boolean(isLastUser && m.status === "read")}
                      onSelect={setSelectedMessageId}
                      onSwipeReply={(id) => {
                        const target = messages.find((x) => x.id === id) ?? null;
                        if (!target) return;
                        setReplyTo(target);
                        triggerMobileHaptic(10);
                      }}
                    />
                    {product ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[89%] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/88 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm ${m.role === "user" ? "ml-auto" : ""}`}
                      >
                        {(() => {
                          const badge = getSalesBadge(product);
                          const badgeClass =
                            badge.tone === "emerald"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : badge.tone === "amber"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-slate-200 bg-slate-100 text-slate-600";
                          return (
                            <div className="px-3 pt-3">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>{badge.label}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-stretch gap-3 p-3">
                          <img src={product.image} alt={product.title} className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" loading="lazy" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">{product.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{product.availability}</p>
                            <p className="mt-1 text-sm font-semibold text-emerald-700">{product.price}</p>
                          </div>
                        </div>
                        <div className="border-t border-slate-100 bg-slate-50/60 p-2">
                          <button
                            onClick={() => {
                              setInput(`Je suis interesse par ${product.title}.`);
                              setReplyTo(m);
                              triggerMobileHaptic(8);
                            }}
                            className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          >
                            Je suis interesse
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                );
              })}
              {isTyping ? <TypingIndicator name={humanAgent.name} avatarUrl={agentAvatarUrl} avatarOk={avatarOk} initials={initials(humanAgent.name)} /> : null}
              <div ref={bottomRef} />
            </motion.div>
          </main>

          <AnimatePresence>
            {selectedMessage ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mx-3 mb-2 rounded-2xl border border-white/70 bg-white/88 p-2 shadow-[0_14px_35px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:mx-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">Message selectionne</div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setReplyTo(selectedMessage); setSelectedMessageId(null); }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Repondre</button>
                    <button onClick={() => { copyText(selectedMessage.content); setSelectedMessageId(null); }} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">Copier</button>
                    <button onClick={() => { addReaction(selectedMessage.id, "❤️"); setSelectedMessageId(null); }} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">❤️</button>
                    <button onClick={() => { addReaction(selectedMessage.id, "👍"); setSelectedMessageId(null); }} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">👍</button>
                    <button onClick={() => { deleteMessage(selectedMessage.id); setSelectedMessageId(null); }} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-600">Supprimer</button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {replyTo ? (
            <div className="mx-3 mb-2 mt-1 rounded-2xl border border-white/70 bg-white/82 p-2 backdrop-blur-xl sm:mx-5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500">Reponse a</div>
                  <div className="truncate text-xs text-slate-600">{excerpt(replyTo)}</div>
                </div>
                <button onClick={() => setReplyTo(null)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  Annuler
                </button>
              </div>
            </div>
          ) : null}

          {pendingImage ? (
            <div className="mx-3 mb-2 mt-1 rounded-2xl border border-white/70 bg-white/80 p-2 backdrop-blur-xl sm:mx-5">
              <div className="flex items-center justify-between px-1 pb-2 text-xs text-slate-500">
                <span>{pendingImageName || "Piece jointe"}</span>
                <button onClick={clearPendingImage} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  Retirer
                </button>
              </div>
              <img src={pendingImage} alt="Apercu" className="h-24 w-full rounded-xl object-cover" />
            </div>
          ) : null}

          <ChatComposer
            input={input}
            sending={sending}
            canSend={Boolean(agentId) && (!!input.trim() || !!pendingImage)}
            hasAttachment={Boolean(pendingImage)}
            onAttach={() => fileRef.current?.click()}
            onInputChange={setInput}
            onSend={send}
          />
        </div>
      </div>
      <ChatDebugPanel />
    </div>
  );
}
