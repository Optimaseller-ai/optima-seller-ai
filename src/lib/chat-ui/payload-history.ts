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

/** 05h–17h Bonjour, 18h–04h Bonsoir (Africa/Douala). */
export function getDoualaTimeGreeting(now = new Date()): string {
  const h = getDoualaLocalHour(now);
  const label = h >= 5 && h <= 17 ? "Bonjour" : "Bonsoir";
  console.log("[FRONTEND_GREETING_TIME]", { hourDouala: h, label });
  return `${label} 👋`;
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
    return true;
  });

  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of filtered) {
    const role = m.role as "user" | "assistant";
    const content = normalizeContent(m);
    const prev = out[out.length - 1];
    if (prev && prev.role === role) {
      // Keep latest turn per role (fixes assistant/assistant/assistant pollution).
      out[out.length - 1] = { role, content };
      continue;
    }
    out.push({ role, content });
  }

  const sliced = out.slice(-max);
  console.log("[PAYLOAD_HISTORY_SANITIZED]", {
    inLen: messages.length,
    afterFilter: filtered.length,
    outLen: sliced.length,
    roles: sliced.map((x) => x.role),
  });
  return sliced;
}
