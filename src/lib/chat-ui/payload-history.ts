/**
 * Sanitize chat history before POST /api/chat/send — never send UI-only or seeded turns.
 */

export type PayloadHistoryMessage = {
  role: "user" | "assistant" | string;
  content: string;
  typing?: boolean;
  transient?: boolean;
  candidate?: boolean;
};

const LEGACY_INTRO_SEED_RE =
  /\b(bonjour\s+et\s+bienvenue|bonsoir\.?\s*bienvenue|bienvenue\s+chez|je\s+suis\s+.+\s+du\s+service\s+client|dites-moi\s+(ce\s+que\s+vous\s+)?cherchez.*budget)\b/i;

export function getDoualaLocalHour(now = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Douala",
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const n = hour != null ? Number(hour) : NaN;
    if (Number.isFinite(n)) return n;
  } catch {
    // ignore
  }
  return now.getHours();
}

/** Aligné backend: 05–11 Bonjour, 12–17 Bonjour, 18–23 Bonsoir, 00–04 Salut (Africa/Douala). */
export function buildTemporalGreetingLabel(now = new Date()): string {
  const h = getDoualaLocalHour(now);
  let label: string;
  if (h >= 5 && h < 12) label = "Bonjour";
  else if (h >= 12 && h < 18) label = "Bonjour";
  else if (h >= 18 && h <= 23) label = "Bonsoir";
  else label = "Salut";
  console.log("[TEMPORAL_GREETING]", { hourDouala: h, greeting: label, timezone: "Africa/Douala" });
  console.log("[TIMEZONE_CONTEXT]", { timezone: "Africa/Douala", hour: h });
  return label;
}

/** @deprecated Prefer buildFrontendIntroLine for first-open UI preview. */
export function getDoualaTimeGreeting(now = new Date()): string {
  return `${buildTemporalGreetingLabel(now)} 👋`;
}

/** Une seule bulle d'accueil UI (non persistée, non envoyée au backend). */
export function buildFrontendIntroLine(args: {
  businessName: string;
  agentName: string;
  now?: Date;
}): string {
  const greeting = buildTemporalGreetingLabel(args.now);
  const biz = String(args.businessName ?? "").trim() || "notre boutique";
  const agent = String(args.agentName ?? "").trim() || "votre conseiller";
  return `${greeting}, bienvenue chez ${biz}. Je suis ${agent}.`;
}

export function isLegacyIntroSeedContent(content: string): boolean {
  return LEGACY_INTRO_SEED_RE.test(String(content ?? "").trim());
}

/** Retire l'ancien triptyque assistant/assistant/assistant persisté en localStorage. */
export function stripLegacyIntroSeedsFromMessages<T extends { role: string; content: string }>(
  messages: T[],
): { messages: T[]; removed: number } {
  const list = Array.isArray(messages) ? messages : [];
  const onlyAssistants =
    list.length >= 2 &&
    list.every((m) => m.role === "assistant") &&
    list.some((m) => isLegacyIntroSeedContent(m.content));
  if (!onlyAssistants) {
    const filtered = list.filter((m) => !(m.role === "assistant" && isLegacyIntroSeedContent(m.content)));
    const removed = list.length - filtered.length;
    if (removed > 0) {
      console.log("[LEGACY_INTRO_SEED_PURGED]", { removed });
    }
    return { messages: filtered, removed };
  }
  console.log("[LEGACY_INTRO_SEED_PURGED]", { removed: list.length, mode: "all_assistant_block" });
  return { messages: [], removed: list.length };
}

function normalizeContent(m: PayloadHistoryMessage): string {
  return String(m.content ?? "").trim();
}

/** Drop transient/candidate/typing/empty; enforce user/assistant alternation. */
export function sanitizePayloadHistory(
  messages: PayloadHistoryMessage[],
  opts?: { maxItems?: number },
): Array<{ role: "user" | "assistant"; content: string }> {
  const max = opts?.maxItems ?? 12;
  const stripped = stripLegacyIntroSeedsFromMessages(
    messages.filter((m) => m.role === "user" || m.role === "assistant") as Array<{
      role: string;
      content: string;
    }>,
  );
  let filtered = messages.filter((m) => {
    if (m.typing) return false;
    if (m.transient === true) {
      console.log("[TRANSIENT_MESSAGE_FILTERED]", { content: normalizeContent(m).slice(0, 80) });
      return false;
    }
    if (m.candidate === true) return false;
    const content = normalizeContent(m);
    if (!content) return false;
    if (m.role !== "user" && m.role !== "assistant") return false;
    if (m.role === "assistant" && isLegacyIntroSeedContent(content)) return false;
    return true;
  });

  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of filtered) {
    const role = m.role as "user" | "assistant";
    const content = normalizeContent(m);
    const prev = out[out.length - 1];
    if (prev && prev.role === role) {
      out[out.length - 1] = { role, content };
      continue;
    }
    out.push({ role, content });
  }

  const sliced = out.slice(-max);
  console.log("[PAYLOAD_HISTORY_SANITIZED]", {
    inLen: messages.length,
    legacyRemoved: stripped.removed,
    afterFilter: filtered.length,
    outLen: sliced.length,
    roles: sliced.map((x) => x.role),
  });
  return sliced;
}
