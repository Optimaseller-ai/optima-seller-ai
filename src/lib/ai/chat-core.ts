import { z } from "zod";
import { DateTime } from "luxon";
import { serverEnv } from "@/lib/server-env";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_MODELS = [
  "openai/gpt-4o-mini",
  "deepseek/deepseek-chat-v3",
  "anthropic/claude-3.5-sonnet",
  "perplexity/sonar",
] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

const CORE_MODES = [
  "reply",
  "followup",
  "closing",
  "complaint",
  "promo",
  "business_chat",
] as const;
export type CoreMode = (typeof CORE_MODES)[number];

export const chatCoreRequestSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      }),
    )
    .default([]),
  mode: z.enum(CORE_MODES).optional(),
  userTimezone: z.string().min(1).optional(),
  model: z.enum(ALLOWED_MODELS).optional(),
  responseFormat: z.enum(["single", "items_3"]).optional(),
});

export type ChatCoreCapabilities = {
  realtime: boolean;
  webSearch: boolean;
  businessMemory: boolean;
  timezone: string;
  currentDateTime: string;
};

export type ChatCoreResponse =
  | { ok: true; data: { id: string | null; model: string; message: string; capabilities: ChatCoreCapabilities } }
  | { ok: false; status: number; error: string };

const SYSTEM_PROMPT = [
  "You are Optima Seller AI.",
  "",
  "You are a virtual WhatsApp sales and customer service employee for businesses.",
  "You help entrepreneurs, shops, freelancers, SMEs manage customer conversations and increase sales.",
  "",
  "Rules:",
  "* Never act like a generic chatbot.",
  "* Never say you are just an AI assistant.",
  "* Reply like a trained human sales/customer support rep.",
  "* Use French by default. If the user speaks another language, adapt.",
  "* Be concise, practical, and contextual.",
  "* Be persuasive when needed, and reassuring.",
  "* Detect user intent.",
  "* Use current date/time.",
  "* Use user timezone, default Africa/Douala.",
  "* If user asks recent info, trends, prices, news: use web search.",
  "* Never hallucinate. If you are not sure, search or ask one useful clarifying question.",
].join("\n");

function modeInstruction(mode: CoreMode) {
  switch (mode) {
    case "business_chat":
      return [
        "MODE: Assistant IA Business",
        "Goal: general business assistant for entrepreneurs using WhatsApp.",
        "You can help with strategy, support, and rewriting messages.",
        "Keep answers practical and action-oriented.",
      ].join("\n");
    case "reply":
      return [
        "MODE: Répondre client",
        "When customer asks information/availability/price/delivery/trust questions.",
        "Tone: professional, warm, clear, reassuring.",
        "Goal: answer quickly and move the customer to the next step (question/CTA).",
      ].join("\n");
    case "followup":
      return [
        "MODE: Relancer prospect",
        "When prospect stopped replying or delayed decision.",
        "Tone: polite, non-pushy, smart.",
        "Goal: restart conversation with curiosity and an easy next reply.",
      ].join("\n");
    case "closing":
      return [
        "MODE: Conclure vente",
        "When customer is interested and near purchase.",
        "Tone: confident, smooth, practical.",
        "Goal: guide to payment/booking/confirmation and propose the next step clearly.",
      ].join("\n");
    case "complaint":
      return [
        "MODE: Gérer plainte",
        "When customer is unhappy/angry (delay/complaint/frustration).",
        "Tone: calm, respectful, empathetic.",
        "Goal: reduce tension, propose solution options, retain the customer.",
      ].join("\n");
    case "promo":
      return [
        "MODE: Message promo",
        "When user wants a broadcast/campaign/offer text.",
        "Tone: engaging, persuasive, natural.",
        "Goal: generate interest + clear CTA. Keep it WhatsApp-friendly.",
      ].join("\n");
  }
}

function normalizeTimezone(raw: string | undefined) {
  const tz = (raw ?? "").trim();
  if (!tz) return "Africa/Douala";
  try {
    const dt = DateTime.now().setZone(tz);
    return dt.isValid ? tz : "Africa/Douala";
  } catch {
    return "Africa/Douala";
  }
}

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { expiresAt: number; context: string | null }>();

async function loadBusinessProfileContext() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const cached = profileCache.get(data.user.id);
    if (cached && cached.expiresAt > Date.now()) return cached.context;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "full_name,business_name,business_type,city,country,whatsapp_number,main_goal,offer_description,brand_tone,response_style,language,first_name,shop_name",
      )
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile) return null;
    const record = profile as Record<string, unknown>;
    const fullName =
      typeof record.full_name === "string"
        ? record.full_name
        : typeof record.first_name === "string"
          ? record.first_name
          : null;
    const businessName =
      typeof record.business_name === "string"
        ? record.business_name
        : typeof record.shop_name === "string"
          ? record.shop_name
          : null;

    const contextLines = [
      fullName ? `Owner name: ${fullName}` : null,
      businessName ? `Business name: ${businessName}` : null,
      typeof record.business_type === "string" && record.business_type ? `Business type: ${record.business_type}` : null,
      typeof record.country === "string" && record.country ? `Country: ${record.country}` : null,
      typeof record.city === "string" && record.city ? `City: ${record.city}` : null,
      typeof record.whatsapp_number === "string" && record.whatsapp_number ? `Business WhatsApp: ${record.whatsapp_number}` : null,
      typeof record.main_goal === "string" && record.main_goal ? `Main goal: ${record.main_goal}` : null,
      typeof record.brand_tone === "string" && record.brand_tone ? `Brand tone: ${record.brand_tone}` : null,
      typeof record.response_style === "string" && record.response_style ? `Response style: ${record.response_style}` : null,
      typeof record.language === "string" && record.language ? `Primary language: ${record.language}` : null,
      typeof record.offer_description === "string" && record.offer_description ? `Offer/products: ${record.offer_description}` : null,
    ].filter(Boolean);

    const context = contextLines.length ? contextLines.join("\n") : null;
    profileCache.set(data.user.id, { context, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
    return context;
  } catch {
    return null;
  }
}

async function openRouterChat(args: {
  model: AllowedModel;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  timeoutMs: number;
}) {
  if (!serverEnv.OPENROUTER_API_KEY) {
    return { ok: false as const, status: 500, error: "Missing OPENROUTER_API_KEY on server." };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      model: args.model,
      temperature: args.temperature,
      messages: args.messages,
      tools: [
        {
          type: "openrouter:web_search",
          parameters: {
            engine: "auto",
            max_results: 5,
            max_total_results: 10,
            search_context_size: "medium",
          },
        },
      ],
    }),
  }).finally(() => clearTimeout(timeout));

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return {
      ok: false as const,
      status: resp.status,
      error: `OpenRouter error (${resp.status}): ${text.slice(0, 400)}`,
    };
  }

  type OrChoice = { message?: { content?: unknown } };
  type OrResponse = { choices?: OrChoice[]; model?: string; id?: string };
  const data = (await resp.json()) as unknown as OrResponse;
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    return { ok: false as const, status: 502, error: "OpenRouter: invalid response." };
  }

  return { ok: true as const, data: { id: data.id ?? null, model: (data.model ?? args.model) as string, message: content } };
}

async function withRetries<T>(fn: () => Promise<T>, opts: { retries: number; baseDelayMs: number }): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function splitToThreeItems(text: string) {
  const trimmed = text.trim();
  const parsed = safeJsonParse(trimmed);
  const schema = z.object({ items: z.array(z.string()).min(1) });
  const result = schema.safeParse(parsed);
  if (result.success) return result.data.items.slice(0, 3);

  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^(\d+[.)]\s+|[-*]\s+)/, ""));

  // heuristic grouping: split by blank lines if present
  const byBlocks = trimmed
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const candidates = byBlocks.length >= 3 ? byBlocks : lines;
  return candidates.slice(0, 3);
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function runChatCore(raw: unknown): Promise<ChatCoreResponse> {
  const parsed = chatCoreRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid request body." };
  }

  const primaryModel: AllowedModel = parsed.data.model ?? "openai/gpt-4o-mini";
  const fallbackModels: AllowedModel[] = [
    "deepseek/deepseek-chat-v3",
    "anthropic/claude-3.5-sonnet",
    "perplexity/sonar",
  ].filter((m) => m !== primaryModel) as AllowedModel[];

  const userTz = normalizeTimezone(parsed.data.userTimezone);
  const now = DateTime.now().setZone(userTz);
  const current = `${now.toFormat("yyyy-LL-dd HH:mm")} (${userTz})`;

  const mode: CoreMode = parsed.data.mode ?? "reply";
  const sanitizedHistory = parsed.data.history.filter((m) => m.role === "user" || m.role === "assistant").slice(-8);

  const businessProfile = await loadBusinessProfileContext();

  const wantsItems3 = parsed.data.responseFormat === "items_3";
  const formatInstructions = wantsItems3
    ? [
        "Output format:",
        `Return exactly 3 proposals as strict JSON: {"items":["...","...","..."]}`,
        "No other keys. No text outside JSON.",
      ].join("\n")
    : [
        "Output format:",
        "- Provide one high-quality message the user can copy-paste to WhatsApp.",
        "- Keep it short (2–6 lines), friendly, professional.",
        "- If needed, ask exactly ONE clarifying question at the end.",
      ].join("\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: [
        SYSTEM_PROMPT,
        "",
        modeInstruction(mode),
        "",
        `Current date/time: ${current}.`,
        `User timezone: ${userTz}.`,
        businessProfile ? "" : null,
        businessProfile ? `Business profile context:\n${businessProfile}` : null,
        "",
        formatInstructions,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...sanitizedHistory,
    { role: "user", content: parsed.data.message },
  ];

  async function callModel(model: AllowedModel) {
    const res = await openRouterChat({ model, messages, temperature: 0.4, timeoutMs: 25_000 });
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }

  try {
    const result = await withRetries(async () => callModel(primaryModel), { retries: 1, baseDelayMs: 350 });
    const capabilities: ChatCoreCapabilities = {
      realtime: true,
      webSearch: true,
      businessMemory: Boolean(businessProfile),
      timezone: userTz,
      currentDateTime: current,
    };
    return { ok: true, data: { ...result, capabilities } };
  } catch (err: unknown) {
    let lastMessage = err instanceof Error ? err.message : "Unknown error";
    for (const fm of fallbackModels) {
      try {
        const result = await withRetries(async () => callModel(fm), { retries: 1, baseDelayMs: 350 });
        const capabilities: ChatCoreCapabilities = {
          realtime: true,
          webSearch: true,
          businessMemory: Boolean(businessProfile),
          timezone: userTz,
          currentDateTime: current,
        };
        return { ok: true, data: { ...result, capabilities } };
      } catch (fallbackErr: unknown) {
        lastMessage = fallbackErr instanceof Error ? fallbackErr.message : lastMessage;
      }
    }
    return { ok: false, status: 502, error: lastMessage };
  }
}

export function extractItems3FromCoreMessage(coreMessage: string) {
  return splitToThreeItems(coreMessage);
}

