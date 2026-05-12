import { DateTime } from "luxon";
import { z } from "zod";
import { openRouterKeepAliveAgent } from "@/lib/ai/openrouter";
import { resolveBusinessTimezone } from "@/lib/ai/businessTimezoneResolver";
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

const AI_TONE_BLACKLIST = [
  // "I'm here to help" variants
  "Je suis là pour vous aider",
  "Je suis ici pour vous aider",
  "Je suis là pour t'aider",
  "Je suis ici pour t'aider",
  "Je peux vous aider",
  "Je peux t'aider",
  "Puis-je vous aider",
  "Puis-je t'aider",
  "Comment puis-je vous aider",
  "Comment puis-je t'aider",
  "Comment puis-je vous assister",
  "Comment puis-je t'assister",
  "Que puis-je faire pour vous",
  "Que puis-je faire pour toi",
  
  // "I understand" variants
  "Je comprends",
  "Je comprend",
  "Je sais que",
  "Je vois que",
  "Je remarque que",
  
  // "No problem" variants
  "Pas de souci",
  "Pas de problème",
  "C'est pas grave",
  "T'inquiète pas",
  "Vous inquiétez pas",
  "Pas d'inquiétude",
  
  // "Searching/Looking for" forced questions
  "Cherchez-vous",
  "Tu cherches",
  "Vous cherchez",
  "Tu cherches des",
  "Vous cherchez des",
  "Que cherchez-vous",
  "Qu'est-ce que tu cherches",
  
  // "Don't hesitate" variants
  "N'hésitez pas",
  "N'hésite pas",
  "N'hésite pas à",
  "N'hésitez pas à",
  "N'hésite pas de",
  "N'hésitez pas de",
  
  // "Let me know" variants
  "Faites-moi savoir",
  "Fais-moi savoir",
  "Laissez-moi savoir",
  "Laisse-moi savoir",
  
  // "I would be happy" variants
  "Je serais heureux",
  "Je serais heureuse",
  "Je serais ravi",
  "Je serais ravie",
  "Je serais enchanté",
  "Je serais enchanté",
  
  // AI-specific phrases
  "Je suis une IA",
  "Je suis un chatbot",
  "Je suis une intelligence artificielle",
  "Je suis juste une IA",
  "Je suis un assistant",
  "Je suis votre assistant",
  "Je suis ton assistant",
  "Comme un assistant IA",
  "En tant qu'IA",
  "En tant qu'assistant",
  
  // Generic follow-ups to avoid
  "Si vous avez des questions",
  "Si tu as des questions",
  "Si vous avez besoin",
  "Si tu as besoin",
  "Avez-vous d'autres questions",
  "As-tu d'autres questions",
  "Avez-vous d'autres besoins",
  "As-tu d'autres besoins",

  // Strict anti-generic support phrases (French)
  "Comment puis-je vous aider",
  "Comment puis-je vous assister",
  "Je suis là pour vous aider",
  "Je suis là pour t'aider",
  "N’hésitez pas",
  "N'hésitez pas",
  "Je comprends",
  "Je suis désolé",
  "Je suis désolée",
  "Désolé",
  "Je peux vous assister",
  "Avez-vous besoin d'autre chose",
  "Avez-vous besoin d’autre chose",
  "Je reste disponible",
  "Je reste à votre disposition",
  "Je vais faire de mon mieux",
  "Tu cherches des informations",
  "Tu cherches des infos",
];

function cleanAITone(text: string): string {
  let cleaned = text;

  // Remove overly formal AI patterns (case-insensitive)
  for (const phrase of AI_TONE_BLACKLIST) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  }

  // Clean up resulting double spaces, tabs, and extra newlines
  cleaned = cleaned
    .replace(/  +/g, " ")  // multiple spaces → single space
    .replace(/\t+/g, " ") // tabs → space
    .replace(/\n\s*\n\s*\n+/g, "\n\n") // triple+ newlines → double newline
    .trim();
  
  // Remove trailing question marks left behind from removed phrases
  // e.g., "Bonjour ?" after removing "Comment puis-je vous aider ?"
  cleaned = cleaned.replace(/\s*\?\s*$/, "").trim();
  
  // Remove lines that became empty after phrase removal
  const lines = cleaned.split("\n").filter(line => line.trim().length > 0);
  cleaned = lines.join("\n");
  return cleaned;
}

const SYSTEM_PROMPT = [
  "You are a real human sales/customer service rep on WhatsApp for the business.",
  "You are never presented as a chatbot or generic AI assistant.",
  "",
  "═══════════════════════════════════════════════════════════════",
  "CORE BEHAVIOR (CRITICAL):",
  "═══════════════════════════════════════════════════════════════",
  "",
  "1️⃣  PROFESSIONAL HUMAN EMPLOYEE",
  "   - Speak like a premium customer advisor",
  "   - Respectful, calm, and business-focused",
  "   - Natural and warm, never robotic",
  "   - No teenage slang or overfamiliar style",
  "",
  "2️⃣  FORM OF ADDRESS (CRITICAL)",
  "   - Use 'vous' by default in French.",
  "   - Never start with tutoiement.",
  "   - You may switch to 'tu' only if the prospect repeatedly uses tutoiement in a relaxed discussion.",
  "",
  "3️⃣  ENERGY VARIES BY MOOD OF PROSPECT",
  "   User is excited → Match excitement, be energetic (still brief)",
  "   User is hesitant → Be warm, reassuring, calm (reduce pressure)",
  "   User is frustrated → Be professional, solution-focused (fix quickly)",
  "   User is neutral → Be direct and efficient",
  "   User is joking → Light humor, natural tone",
  "   Adapt your tone AUTOMATICALLY.",
  "",
  "4️⃣  NEVER WRITE FAQ OR CHATGPT RESPONSES",
  "   Forbidden: output none of the generic support-script phrases.",
  "   Strict blacklist (examples):",
  "   - 'Comment puis-je vous aider ?'",
  "   - 'Je suis là pour vous aider.'",
  "   - 'N’hésitez pas.'",
  "   - 'Je comprends.'",
  "   - 'Je suis désolé.'",
  "   - 'Je peux vous assister.'",
  "   - 'Avez-vous besoin d’autre chose ?'",
  "   - 'Je reste disponible.'",
  "   - 'Je vais faire de mon mieux.'",
  "   - 'Tu cherches des informations ?'",
  "   Prefer a direct, human WhatsApp business reply (short, imperfect, natural).",
  "",
  "5️⃣  MAX LENGTH: 2 SHORT SENTENCES",
  "   Mobile-first and clear.",
  "   One concise message is preferred.",
  "",
  "6️⃣  EMOTIONAL MEMORY",
  "   - Detect prospect's emotional state",
  "   - If they complain → Show empathy + action",
  "   - If they're interested → Get excited too",
  "   - If they're cold → Warm it up naturally",
  "   - If they joke → Joke back",
  "   Your tone follows their energy.",
  "",
  "7️⃣  PROFESSIONAL GREETINGS",
  "   For a first greeting, use service-level welcomes such as:",
  "   - 'Bonjour et bienvenue chez {business_name}. Je suis {agent_name} du service client.'",
  "   - 'Bonsoir Monsieur, bienvenue chez {business_name}.'",
  "   - 'Bonjour Madame, bienvenue chez {business_name}.'",
  "   Avoid familiar greetings like 'hey', 'yo', 'coucou'.",
  "",
  "8️⃣  DETECTION OF BUYING INTENT → PREMIUM SELLER MODE",
  "   When prospect shows interest (asks price, availability, etc.):",
  "   - Become MORE professional (not cold, just polished)",
  "   - More reassuring",
  "   - Solution-oriented",
  "   - Confident but not pushy",
  "   - Guide them toward decision",
  "",
  "9️⃣  NO ROBOTIC DISCLAIMERS",
  "   ❌ 'Je suis là pour vous aider'",
  "   ❌ 'Je comprends'",
  "   ❌ 'Je suis une IA'",
  "   ❌ 'Comme mentionné'",
  "   ✅ Just be human",
  "",
  "🔟 IF UNSURE → ASK ONE CLEAR QUESTION",
  "   ✅ 'Quel modèle vous intéresse le plus ?'",
  "   ✅ 'Quelle taille souhaitez-vous ?'",
  "   ✅ 'Pour quelle date, s'il vous plaît ?'",
  "",
  "═══════════════════════════════════════════════════════════════",
  "LANGUAGE:",
  "═══════════════════════════════════════════════════════════════",
  "- French by default, adapt if user switches languages",
  "- Use 'vous' by default. Switch to 'tu' only after repeated user tutoiement.",
  "- Use {business_name} and {agent_name} naturally",
  "- Emojis are optional and rare (0 or 1 max when truly natural)",
  "- Never stack multiple emojis",
  "",
  "═══════════════════════════════════════════════════════════════",
  "GOAL:",
  "Prospect thinks: 'This is a real person from the business team'",
  "NOT: 'This is ChatGPT pretending to be human'",
  "═══════════════════════════════════════════════════════════════",
].join("\n");

function modeInstruction(mode: CoreMode) {
  switch (mode) {
    case "business_chat":
      return [
        "MODE: Business advisor (not customer)",
        "Help with strategy, writing, rewriting, thinking.",
        "Be practical. Be direct. No fluff. No questions unless needed.",
      ].join("\n");
    case "reply":
      return [
        "MODE: Reply to customer (MOST IMPORTANT)",
        "",
        "CRITICAL: Be a professional human employee, never generic AI.",
        "Start in vouvoiement and keep a premium service tone.",
        "",
        "SHORT REACTIONS (when appropriate):",
        "  'Bien reçu.'",
        "  'Avec plaisir Monsieur.'",
        "  'Je vous en prie.'",
        "  'Très bien, je vérifie cela.'",
        "",
        "MATCH THEIR ENERGY:",
        "  If excited → Match excitement",
        "  If hesitant → Be warm & reassuring",
        "  If frustrated → Be solution-focused",
        "  If joking → Joke back",
        "",
        "VARIABLE TONE (always professional):",
        "  Sometimes direct, sometimes warm, never casual slang.",
        "  Keep credibility and trust first.",
        "",
        "LENGTH: Keep it SHORT. 1-2 sentences max.",
        "If more to say, send in 2 quick separate messages.",
      ].join("\n");
    case "followup":
      return [
        "MODE: Follow up with prospect",
        "Customer went quiet. Restart naturally.",
        "Be human and professional - show genuine interest, not desperation.",
        "Examples:",
        "  'Souhaitez-vous que je vous réserve cela ?'",
        "  'Souhaitez-vous que nous finalisions votre commande ?'",
        "  'Voulez-vous que je vous envoie les détails ?'",
        "  'Avez-vous une préférence précise avant validation ?'",
      ].join("\n");
    case "closing":
      return [
        "MODE: Close the sale",
        "Customer wants to buy. Make it smooth & natural.",
        "Be confident but not pushy.",
        "Guide to next step: payment, booking, delivery.",
        "Keep it human - they're making a decision.",
      ].join("\n");
    case "complaint":
      return [
        "MODE: Handle complaint",
        "Customer is upset. Be real, empathetic, action-oriented.",
        "Don't over-apologize.",
        "Acknowledge + propose solutions quickly.",
        "Show you care about fixing it.",
      ].join("\n");
    case "promo":
      return [
        "MODE: Promotional message",
        "Write like a real seller on Instagram/WhatsApp.",
        "Engaging, clear CTA, brief.",
        "Make people WANT to engage.",
        "Use emojis naturally, not forced.",
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

function detectProspectEmotion(userMessage: string): "excited" | "hesitant" | "frustrated" | "neutral" | "joking" {
  const msg = String(userMessage ?? "").toLowerCase().trim();
  
  // Excited indicators
  if (/(super|trop|wow|ouais|oui oui|génial|intéressant|cool|sympa|parfait|excellent|top|awesome|yay|🔥|⚡|😍|🎉)/i.test(msg)) {
    return "excited";
  }
  
  // Frustrated/Angry indicators
  if (/(cher|trop cher|pas bon|nul|débile|angry|frustré|marre|pas d'accord|n'aime pas|horrible|😠|😡|🤬)/i.test(msg)) {
    return "frustrated";
  }
  
  // Hesitant/Unsure indicators
  if (/(hésit|peut-être|sais pas|pas sûr|doute|réfléchir|attendre|plutôt|pas vraiment|euh|hmm|🤔|😕)/i.test(msg)) {
    return "hesitant";
  }
  
  // Joking/Playful indicators
  if (/(😂|😄|😆|😉|blague|rigole|haha|lol|😏|😜)/i.test(msg)) {
    return "joking";
  }
  
  return "neutral";
}

function detectBuyingIntent(userMessage: string): boolean {
  const msg = String(userMessage ?? "").toLowerCase().trim();
  return /(combien|prix|coûte|payer|paiement|commander|acheter|réserver|booking|livraison|quand|disponible|stock|intéressé|je veux|tu peux|on peut|c'est possible)/i.test(msg);
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
    Connection: "keep-alive",
  };
  if (serverEnv.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = serverEnv.OPENROUTER_SITE_URL;
  if (serverEnv.OPENROUTER_APP_NAME) headers["X-OpenRouter-Title"] = serverEnv.OPENROUTER_APP_NAME;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  const started = Date.now();
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    signal: controller.signal,
    dispatcher: openRouterKeepAliveAgent,
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
  } as RequestInit).finally(() => clearTimeout(timeout));

  const durationMs = Date.now() - started;
  console.log("[OPTIMA_AI_CHAT_CORE]", "openrouter_response", { status: resp.status, durationMs, model: args.model });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const errPayload = { status: resp.status, durationMs, snippet: text.slice(0, 400) };
    if (resp.status === 429 || resp.status >= 500) console.error("[OPTIMA_AI_ERROR]", errPayload);
    else console.error("[OPTIMA_AI_CHAT_CORE]", "openrouter_http_error", errPayload);
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

  const userTz = normalizeTimezone(parsed.data.userTimezone);
  const resolvedBusinessTz =
    businessProfile?.city || businessProfile?.country
      ? resolveBusinessTimezone({ city: businessProfile.city, country: businessProfile.country })
      : null;
  const effectiveTz = resolvedBusinessTz?.iana ?? userTz;
  const now = DateTime.now().setZone(effectiveTz);
  const current = `${now.toFormat("yyyy-LL-dd HH:mm")} (${effectiveTz})`;

  if (isWhoAmIIntent(parsed.data.message) && businessProfile) {
    const capabilities: ChatCoreCapabilities = {
      realtime: true,
      webSearch: true,
      businessMemory: true,
      timezone: effectiveTz,
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
        "SINGLE message (not multiple). WhatsApp-style reply.",
        "ULTRA SHORT: 1-2 small sentences. Less is more.",
        "Examples of perfect length:",
        "  ✅ 'Oui. On en a encore.'",
        "  ✅ 'Ah d'accord. C'est bon.'",
        "  ✅ 'Demain, c'est OK.'",
        "Don't write paragraphs. Real humans on WhatsApp write short.",
        "Emotion > Grammar. Reaction > Explanation.",
      ].join("\n");

  // Detect emotional state and buying intent
  const prospectEmotion = detectProspectEmotion(parsed.data.message);
  const hasBuyingIntent = detectBuyingIntent(parsed.data.message);
  
  const emotionTone = {
    excited: "They’re excited. Match their energy. Enthusiastic, still brief.",
    hesitant: "They’re hesitant. Warm, reassuring, calm. Reduce pressure.",
    frustrated: "They’re frustrated. Professional, direct, solution-focused. Fix quickly.",
    joking: "They’re joking. Light humor, natural tone.",
    neutral: "They’re neutral. Direct and efficient. Clear communication.",
  }[prospectEmotion];

  const intentionTone = hasBuyingIntent
    ? "BUYING INTENT DETECTED: They’re interested. Be professional, confident, solution-focused. Guide to decision. No pressure, just smooth."
    : "";

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: [
        SYSTEM_PROMPT,
        "",
        modeInstruction(mode),
        "",
        emotionTone ? `PROSPECT STATE: ${emotionTone}` : null,
        intentionTone ? `INTENT: ${intentionTone}` : null,
        "",
        `Current date/time (business local): ${current}.`,
        `Business local IANA timezone: ${effectiveTz}.`,
        `Client-reported timezone (fallback only): ${userTz}.`,
        [
          "GREETING / LOCAL TIME (business timezone above):",
          "- Use the business local clock as the reference for day vs evening.",
          "- If they say a specific phrase like “good afternoon”, keep it consistent — don’t snap to “good evening” unless blending naturally.",
          "- If their generic greeting mismatches local time, prefer the correct greeting without correcting them harshly (no “it’s not morning”).",
        ].join("\n"),
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
    const cleanedMessage = cleanAITone(result.message);
    const capabilities: ChatCoreCapabilities = {
      realtime: true,
      webSearch: true,
      businessMemory: Boolean(businessProfileContext),
      timezone: effectiveTz,
      currentDateTime: current,
    };
    return { ok: true, data: { ...result, message: cleanedMessage, capabilities } };
  } catch (err: unknown) {
    let lastMessage = err instanceof Error ? err.message : "Unknown error";
    for (const fm of fallbackModels) {
      try {
        const result = await withRetries(async () => callModel(fm), { retries: 1, baseDelayMs: 350 });
        const cleanedMessage = cleanAITone(result.message);
        const capabilities: ChatCoreCapabilities = {
          realtime: true,
          webSearch: true,
          businessMemory: Boolean(businessProfileContext),
          timezone: effectiveTz,
          currentDateTime: current,
        };
        return { ok: true, data: { ...result, message: cleanedMessage, capabilities } };
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
