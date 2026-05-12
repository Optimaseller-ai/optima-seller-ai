import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBusinessTimezone } from "@/lib/ai/businessTimezoneResolver";
import { generateAIReply } from "@/lib/ai/business-context";
import { followupDelayMs, isAgentHoldReply } from "@/lib/chat/agent-hold";
import { resolvePublicPersonaForAgent } from "@/lib/chat/commercial-agents";
import { detectStatusFromUserMessage, getNextRelanceAt, isClosedStatus } from "@/lib/chat/relance";
import { isMissingConversationStateColumn } from "@/lib/chat/conversation-state-db";
import { mergeSellerBehaviorStateAfterAssistant, mergeSellerBehaviorStateForUserTurn } from "@/lib/chat/seller-behavior-state";

export const runtime = "nodejs";

function detectLangFromMessageAndState(args: { message: string; stateLang?: "fr" | "en" }) {
  const m = String(args.message ?? "").toLowerCase().trim();
  if (args.stateLang === "en" || args.stateLang === "fr") return args.stateLang;
  if (/\b(hello|hi|hey|good morning|good evening|how much|price|available|in stock|delivery|pay|payment)\b/i.test(m)) return "en" as const;
  if (/\b(bonjour|bonsoir|svp|s'il vous plaît|combien|prix|disponible|livraison|payer|paiement)\b/i.test(m)) return "fr" as const;
  return "fr" as const;
}

function fb(lang: "fr" | "en") {
  return lang === "en"
    ? {
        error: "Just a moment.",
        noContext: "Hello. What model are you looking for?",
        timeout: "One moment please.",
        apiError: "Let me check that.",
      }
    : {
        error: "Je vérifie.",
        noContext: "Bonjour. Dites-moi juste le modèle que vous cherchez.",
        timeout: "Un instant s'il vous plaît.",
        apiError: "Je regarde cela.",
      };
}

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  agent_id: z.string().uuid(),
  session_id: z.string().trim().min(8).max(200),
  agent_name: z.string().trim().min(2).max(60).optional(),
  agent_personality: z.enum(["chaleureux", "professionnel", "dynamique"]).optional(),
  business_name: z.string().trim().min(2).max(120).optional(),
  sales_style: z.enum(["conseiller", "closer", "premium"]).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .max(12)
    .optional(),
  conversation_state: z
    .object({
      language: z.enum(["fr", "en"]).optional(),
      preferences: z
        .object({
          blacklist: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
        })
        .optional(),
      // Le client peut envoyer "" quand l’humeur n’est pas encore définie — équivalent à absent.
      mood: z.preprocess(
        (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
        z.string().trim().min(1).max(40).optional(),
      ),
      memory: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
      tone_mode: z.enum(["chill", "premium", "vendeur_soft", "support_client", "conversation_naturelle"]).optional(),
      stats: z
        .object({
          turn_count: z.number().optional(),
          fatigue: z.number().optional(),
          last_active_at: z.number().optional(),
        })
        .optional(),
      conversationProfile: z
        .object({
          tone: z.string().optional(),
          interestLevel: z.string().optional(),
          buyingIntent: z.number().optional(),
          preferredProducts: z.array(z.string()).optional(),
          lastTopics: z.array(z.string()).optional(),
          preferredLanguageStyle: z.enum(["formal", "neutral", "warm"]).optional(),
        })
        .optional(),
      lastSellerIntent: z.string().optional(),
      productMemory: z
        .object({
          viewedProducts: z.array(z.string()).optional(),
          budgetHint: z.string().optional(),
          lastMentionedInterest: z.string().optional(),
        })
        .optional(),
      commercialMemory: z
        .object({
          likedProducts: z.array(z.string()).optional(),
          objections: z.array(z.string()).optional(),
          preferences: z.array(z.string()).optional(),
          budgetNotes: z.string().optional(),
          lastObjectionSnippet: z.string().optional(),
        })
        .optional(),
      regionStyle: z.enum(["standard", "west_africa"]).optional(),
    })
    .passthrough()
    .optional(),
});

type StoredMessage = { role: "user" | "assistant"; content: string; ts: string };

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  
  console.log("[API] POST /api/chat/send");
  console.log("[API] Raw request:", { jsonParsed: !!json, validSchema: parsed.success });
  
  if (!parsed.success) {
    console.error("[API] Invalid schema:", parsed.error);
    const lang = detectLangFromMessageAndState({ message: String((json as any)?.message ?? ""), stateLang: (json as any)?.conversation_state?.language });
    return NextResponse.json({ success: true, reply: fb(lang).apiError, error: "INVALID_REQUEST" }, { status: 200 });
  }

  const {
    message,
    agent_id,
    session_id,
    agent_name,
    agent_personality,
    business_name,
    sales_style,
    history: clientHistory,
    conversation_state,
  } = parsed.data;
  const lang = detectLangFromMessageAndState({ message, stateLang: conversation_state?.language });
  const FALLBACK_ERROR_REPLY = fb(lang).error;
  const FALLBACK_NO_CONTEXT_REPLY = fb(lang).noContext;

  console.log("message reçu", message);
  console.log("agent_id", agent_id);
  if (agent_name) console.log("agent_name", agent_name);
  if (agent_personality) console.log("agent_personality", agent_personality);
  if (business_name) console.log("business_name", business_name);
  if (sales_style) console.log("sales_style", sales_style);
  if (conversation_state?.tone_mode) console.log("tone_mode", conversation_state.tone_mode);

  const admin = createAdminClient();

  try {
    console.log("[API] Checking agent...", { agent_id });
    const { data: agent } = await admin
      .from("agents")
      .select("id,user_id,is_active,name,slug,persona_key")
      .eq("id", agent_id)
      .maybeSingle();
    
    if (!agent?.id || !agent.is_active) {
      console.error("[API] Agent not found or inactive", { agent_id, found: !!agent });
      return NextResponse.json({ success: true, reply: FALLBACK_ERROR_REPLY, error: "AGENT_NOT_FOUND" }, { status: 200 });
    }
    
    console.log("[API] Agent found:", { agent_id, user_id: agent.user_id, name: agent.name });

    console.log("[API] Checking subscription...");
    const { data: sub } = await admin.from("subscriptions").select("plan").eq("user_id", agent.user_id).maybeSingle();
    const userPlan = (sub?.plan ?? "free") as string;
    console.log("[API] User subscription:", { plan: userPlan });

    let convRes = await admin
      .from("conversations")
      .select("id,messages,status,relance_count,conversation_state")
      .eq("agent_id", agent_id)
      .eq("session_id", session_id)
      .maybeSingle();
    if (convRes.error && isMissingConversationStateColumn(convRes.error)) {
      console.warn("[API] conversations.conversation_state absente — exécuter la migration SQL; chargement sans cette colonne.");
      convRes = await admin
        .from("conversations")
        .select("id,messages,status,relance_count")
        .eq("agent_id", agent_id)
        .eq("session_id", session_id)
        .maybeSingle();
    } else if (convRes.error) {
      console.error("[OPTIMA_AI_ERROR]", convRes.error);
    }
    const conv = convRes.data;

    if (conv?.id) {
      await admin.from("pending_agent_followups").delete().eq("conversation_id", conv.id);
    }

    const persona = resolvePublicPersonaForAgent({ personaKey: (agent as any).persona_key, agentId: agent.id });

    const { data: ownerProfile } = await admin.from("profiles").select("country,city").eq("id", agent.user_id).maybeSingle();
    const relTz = resolveBusinessTimezone({
      city: typeof (ownerProfile as any)?.city === "string" ? (ownerProfile as any).city : null,
      country: typeof (ownerProfile as any)?.country === "string" ? (ownerProfile as any).country : null,
    }).iana;
    const countryCode = String((ownerProfile as any)?.country ?? "")
      .trim()
      .slice(0, 2)
      .toUpperCase();
    const WAEMU = new Set(["CI", "SN", "ML", "BF", "NE", "TG", "BJ", "GN"]);

    const dbStateRaw = (conv as any)?.conversation_state;
    const dbState = typeof dbStateRaw === "object" && dbStateRaw ? dbStateRaw : {};
    const clientState = typeof conversation_state === "object" && conversation_state ? conversation_state : {};
    const mergedBase = { ...dbState, ...clientState } as Record<string, unknown>;
    if (!mergedBase.regionStyle && WAEMU.has(countryCode)) mergedBase.regionStyle = "west_africa";

    const { state: behaviorState, intent: detectedIntent } = mergeSellerBehaviorStateForUserTurn({
      previous: mergedBase,
      message,
    });

    const nowIso = new Date().toISOString();
    const history = (Array.isArray(conv?.messages) ? (conv?.messages as any[]) : []) as StoredMessage[];
    const nextHistory: StoredMessage[] = [...history, { role: "user", content: message, ts: nowIso }];

    const detectedStatus = detectStatusFromUserMessage(message);

    let reply = FALLBACK_NO_CONTEXT_REPLY;
    try {
      const modelHistory = Array.isArray(clientHistory)
        ? clientHistory.slice(-12)
        : history.slice(-12).map((m) => ({ role: m.role, content: m.content }));

      const approxPromptExtraChars = message.length + modelHistory.reduce((n, m) => n + m.content.length, 0);
      console.log("[OPTIMA_AI_CHAT_SEND] generate_start", {
        agent_id,
        session_id,
        messageLen: message.length,
        historyTurns: modelHistory.length,
        approxContextChars: approxPromptExtraChars,
      });

      const genT0 = Date.now();
      reply = await generateAIReply({
        message,
        userId: agent.user_id,
        agentName: agent_name || persona.name,
        agentPersonality: agent_personality ?? persona.personality,
        businessName: business_name || agent.name,
        salesStyle: sales_style ?? persona.salesStyle,
        agentRole: persona.role,
        agentTone: persona.tone,
        history: modelHistory,
        conversationState: behaviorState,
        personaKey: (agent as any).persona_key ?? persona.id,
      });

      console.log("[OPTIMA_AI_CHAT_SEND] generate_ok", {
        ms: Date.now() - genT0,
        replyLength: reply.length,
        preview: reply.slice(0, 120),
      });
    } catch (e) {
      console.error("[OPTIMA_AI_ERROR]", e);
      console.error("[OPTIMA_AI_CHAT_SEND] generate_failed", { message: (e as any)?.message ?? String(e) });
      reply = FALLBACK_NO_CONTEXT_REPLY;
    }

    console.log("[API] Final reply:", { replyLength: reply.length, reply });

    nextHistory.push({ role: "assistant", content: reply, ts: new Date().toISOString() });

    const conversationStateOut = mergeSellerBehaviorStateAfterAssistant({ state: behaviorState, assistantReply: reply });

    const statusNext = detectedStatus ?? (typeof conv?.status === "string" ? (conv.status as string) : "active");
    const shouldClose = isClosedStatus(statusNext);
    const nextRelanceAt = shouldClose
      ? null
      : getNextRelanceAt({
          relanceCount: typeof conv?.relance_count === "number" ? conv.relance_count : 0,
          from: new Date(),
          businessIanaTimezone: relTz,
        });

    let convId: string | null = conv?.id ?? null;
    if (!convId) {
      const insertFull = {
        agent_id,
        session_id,
        messages: nextHistory as any,
        conversation_state: conversationStateOut as any,
        status: statusNext,
        last_message_at: nowIso,
        last_user_message_at: nowIso,
        last_ai_message_at: new Date().toISOString(),
        relance_count: 0,
        next_relance_at: shouldClose ? null : nextRelanceAt,
        updated_at: new Date().toISOString(),
      };
      let { data: inserted, error: insErr } = await admin.from("conversations").insert(insertFull).select("id").maybeSingle();
      if (insErr && isMissingConversationStateColumn(insErr)) {
        console.warn("[API] Insert sans conversation_state (colonne absente — appliquer supabase/migrations/2026-05-11_conversation_seller_state.sql).");
        const { conversation_state: _drop, ...insertBase } = insertFull;
        ({ data: inserted, error: insErr } = await admin.from("conversations").insert(insertBase).select("id").maybeSingle());
      }
      if (insErr) console.error("[OPTIMA_AI_ERROR]", insErr);
      convId = (inserted as any)?.id ?? null;
    } else {
      const updateFull = {
        status: statusNext,
        last_message_at: nowIso,
        last_user_message_at: nowIso,
        last_ai_message_at: new Date().toISOString(),
        relance_count: 0,
        next_relance_at: shouldClose ? null : nextRelanceAt,
        messages: nextHistory as any,
        conversation_state: conversationStateOut as any,
        updated_at: new Date().toISOString(),
      };
      let { error: upErr } = await admin.from("conversations").update(updateFull).eq("id", convId);
      if (upErr && isMissingConversationStateColumn(upErr)) {
        console.warn("[API] Update sans conversation_state (colonne absente).");
        const { conversation_state: _drop, ...updateBase } = updateFull;
        ({ error: upErr } = await admin.from("conversations").update(updateBase).eq("id", convId));
      }
      if (upErr) console.error("[OPTIMA_AI_ERROR]", upErr);
    }

    if (convId && isAgentHoldReply(reply)) {
      const { error: fuErr } = await admin.from("pending_agent_followups").insert({
        conversation_id: convId,
        scheduled_for: new Date(Date.now() + followupDelayMs(detectedIntent)).toISOString(),
        status: "pending",
        payload: { lastUserMessage: message, lang, conversationState: conversationStateOut, personaKey: (agent as any).persona_key ?? persona.id },
      } as any);
      if (fuErr) console.error("[OPTIMA_AI_ERROR] pending_agent_followups", fuErr);
    }

    return NextResponse.json({ success: true, reply, conversation_state: conversationStateOut }, { status: 200 });
  } catch (e) {
    console.error("[OPTIMA_AI_ERROR]", e);
    console.error("[API] Unexpected error:", { message: (e as any)?.message ?? String(e), stack: (e as any)?.stack });
    const lang = detectLangFromMessageAndState({ message: "", stateLang: (json as any)?.conversation_state?.language });
    return NextResponse.json({ success: true, reply: fb(lang).error, error: "INTERNAL_ERROR" }, { status: 200 });
  }
}
