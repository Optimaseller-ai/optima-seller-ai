import { DateTime } from "luxon";
import { z } from "zod";
import { serverEnv } from "../server-env";
import { createClient as createSupabaseServerClient } from "../supabase/server";
import {
  ALLOWED_MODELS,
  CORE_MODES,
  chatCoreRequestSchema,
  type AllowedModel,
  type CoreMode,
} from "./chat-core.schema";
import { type BusinessProfile, formatWhoAmIResponse, isWhoAmIIntent } from "./whoami";

export { chatCoreRequestSchema } from "./chat-core.schema";

export type ChatCoreCapabilities = {
  realtime: boolean;
  webSearch: boolean;
  businessMemory: boolean;
  timezone: string;
  currentDateTime: string;
};

export type MemoryDebugStatus =
  | { status: "PROFILE_FOUND"; userId: string; fields: Record<string, boolean> }
  | { status: "PROFILE_EMPTY"; reason: string }
  | { status: "AUTH_MISSING" };

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
  "* Business memory rules:",
  "  - When the user asks: 'Qui suis-je ?', 'Who am I?', 'Quel est mon business ?', 'What is my business?', or any question about their activity/offer/sector/city/goal, you MUST use the Business profile context if available.",
  "  - If business profile context is missing or incomplete, say what is missing and ask the user to complete their profile (do NOT invent details).",
  "  - Be specific: always mention business name + city + offer + sector + goal when available.",
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
        "Goal: guide to confirmation/booking/delivery and propose the next step clearly.",
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

// NOTE: We intentionally avoid caching profile lookups. In production, stale profile context is worse
// than an extra read on each AI request, because it makes the assistant behave like it "forgot" the business.

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildProfileContext(profile: BusinessProfile, opts?: { memoryLevel?: "limited" | "advanced" }) {
  const isAdvanced = opts?.memoryLevel === "advanced";

  // Canonical memory block (must remain stable; referenced by QA).
  // This is injected into the hidden system prompt before every generation.
  const contextLines = [
    profile.businessName ? `You are assistant for ${profile.businessName}` : null,
    profile.businessType ? `Sector: ${profile.businessType}` : null,
    profile.city ? `City: ${profile.city}` : null,
    profile.country ? `Country: ${profile.country}` : null,
    profile.offer ? `Offer: ${profile.offer}` : null,
    profile.mainGoal ? `Goal: ${profile.mainGoal}` : null,
    // Advanced memory extras
    isAdvanced && profile.ownerName ? `Owner name: ${profile.ownerName}` : null,
    isAdvanced && profile.whatsapp ? `Business WhatsApp: ${profile.whatsapp}` : null,
    isAdvanced && profile.brandTone ? `Brand tone: ${profile.brandTone}` : null,
    isAdvanced && profile.responseStyle ? `Response style: ${profile.responseStyle}` : null,
    isAdvanced && profile.primaryLanguage ? `Primary language: ${profile.primaryLanguage}` : null,
  ].filter(Boolean);

  return contextLines.length ? contextLines.join("\n") : null;
}

async function loadBusinessProfileContext(opts?: {
  memoryLevel?: "limited" | "advanced";
}): Promise<{ context: string | null; profile: BusinessProfile | null }> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    let user = userData.user ?? null;

    if (!user) {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
      if (!user) {
        console.log("[AI][MEMORY] PROFILE_EMPTY auth_user=null", {
          userErr: userErr?.message ?? null,
          sessionErr: sessionErr?.message ?? null,
        });
        return { context: null, profile: null };
      }
    }

    const { data: profile, error: dbErr } = await supabase
      .from("profiles")
      .select(
        "updated_at,full_name,business_name,business_type,goal,country,city,whatsapp,offer,email,first_name,shop_name,main_goal,whatsapp_number,offer_description",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (dbErr) {
      console.log("[AI][MEMORY] PROFILE_EMPTY db_error", { message: dbErr.message, code: (dbErr as any)?.code ?? null });
      return { context: null, profile: null };
    }

    if (!profile) {
      console.log("[AI][MEMORY] PROFILE_EMPTY row_missing", { userId: user.id });
      return { context: null, profile: null };
    }
    const record = profile as Record<string, unknown>;

    const ownerName = isNonEmptyString(record.full_name)
      ? record.full_name
      : isNonEmptyString(record.first_name)
        ? record.first_name
        : null;

    const businessName = isNonEmptyString(record.business_name)
      ? record.business_name
      : isNonEmptyString(record.shop_name)
        ? record.shop_name
        : null;

    const mainGoal = isNonEmptyString(record.goal)
      ? record.goal
      : isNonEmptyString(record.main_goal)
        ? record.main_goal
        : null;

    const whatsapp = isNonEmptyString(record.whatsapp)
      ? record.whatsapp
      : isNonEmptyString(record.whatsapp_number)
        ? record.whatsapp_number
        : null;

    const offer = isNonEmptyString(record.offer)
      ? record.offer
      : isNonEmptyString(record.offer_description)
        ? record.offer_description
        : null;

    const businessProfile: BusinessProfile = {
      ownerName,
      businessName,
      businessType: isNonEmptyString(record.business_type) ? record.business_type : null,
      country: isNonEmptyString(record.country) ? record.country : null,
      city: isNonEmptyString(record.city) ? record.city : null,
      whatsapp,
      mainGoal,
      brandTone: null,
      responseStyle: null,
      primaryLanguage: null,
      offer,
    };

    const context = buildProfileContext(businessProfile, opts);

    const isEmpty = !context;
    console.log(isEmpty ? "[AI][MEMORY] PROFILE_EMPTY fields_empty" : "[AI][MEMORY] PROFILE_FOUND", {
      userId: user.id,
      hasContext: Boolean(context),
      fields: {
        ownerName: Boolean(ownerName),
        businessName: Boolean(businessName),
        businessType: Boolean(businessProfile.businessType),
        country: Boolean(businessProfile.country),
        city: Boolean(businessProfile.city),
        offer: Boolean(offer),
        goal: Boolean(mainGoal),
      },
    });

    return { context, profile: businessProfile };
  } catch {
    console.log("[AI][MEMORY] PROFILE_EMPTY unexpected_error");
    return { context: null, profile: null };
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

  const plan = parsed.data.plan === "pro" ? "pro" : "free";

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
  const historyMaxAgeMs = plan === "pro" ? Infinity : 3 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const sanitizedHistory = parsed.data.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => {
      if (!m.ts) return plan === "pro";
      const t = Date.parse(m.ts);
      if (!Number.isFinite(t)) return plan === "pro";
      return nowMs - t <= historyMaxAgeMs;
    })
    .slice(-8);

  const memoryLevel = plan === "pro" ? "advanced" : "limited";
  const businessProfileOverride = parsed.data.businessProfile ?? null;
  const businessProfileData = businessProfileOverride
    ? { profile: businessProfileOverride as BusinessProfile, context: buildProfileContext(businessProfileOverride as BusinessProfile, { memoryLevel }) }
    : await loadBusinessProfileContext({ memoryLevel });

  const businessProfileContext = businessProfileData.context;
  const businessProfile = businessProfileData.profile;

  if (isWhoAmIIntent(parsed.data.message) && businessProfile) {
    const capabilities: ChatCoreCapabilities = {
      realtime: true,
      webSearch: true,
      businessMemory: true,
      timezone: userTz,
      currentDateTime: current,
    };
    return {
      ok: true,
      data: { id: null, model: "profile", message: formatWhoAmIResponse(businessProfile), capabilities },
    };
  }

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
        businessProfileContext ? "" : null,
        businessProfileContext ? `Business profile context:\n${businessProfileContext}` : null,
        "",
        formatInstructions,
      ]
        .filter(Boolean)
        .join("\n"),
    },
    ...sanitizedHistory,
    { role: "user", content: parsed.data.message },
  ];

  console.log("[AI][MEMORY] PROMPT_CONTEXT_SENT", { hasBusinessContext: Boolean(businessProfileContext) });
  // Required for end-to-end memory audits: log the exact hidden system prompt sent to the model.
  console.log("[AI][PROMPT] SYSTEM_PROMPT", messages[0]?.content ?? "");

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
      businessMemory: Boolean(businessProfileContext),
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
          businessMemory: Boolean(businessProfileContext),
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
