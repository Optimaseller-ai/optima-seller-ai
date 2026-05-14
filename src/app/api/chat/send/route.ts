import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBusinessTimezone } from "@/lib/ai/businessTimezoneResolver";
import { detectConversationLanguage, type ConversationLanguage } from "@/lib/ai/language-detection";
import { generateAIReply } from "@/lib/ai/business-context";
import { followupDelayMs, isAgentHoldReply } from "@/lib/chat/agent-hold";
import { resolvePublicPersonaForAgent } from "@/lib/chat/commercial-agents";
import { detectStatusFromUserMessage, getNextRelanceAt, isClosedStatus } from "@/lib/chat/relance";
import {
  conversationsInsertWithOptionalColumnFallback,
  conversationsUpdateWithOptionalColumnFallback,
  isMissingConversationStateColumn,
} from "@/lib/chat/conversation-state-db";
import { mergeSellerBehaviorStateAfterAssistant, mergeSellerBehaviorStateForUserTurn } from "@/lib/chat/seller-behavior-state";

export const runtime = "nodejs";

function recentChatFromRequest(args: {
  message: string;
  clientHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Array<{ role: "user" | "assistant"; content: string }> {
  const tail = (Array.isArray(args.clientHistory) ? args.clientHistory : []).slice(-11).map((m) => ({
    role: m.role,
    content: m.content,
  }));
  return [...tail, { role: "user" as const, content: args.message }];
}

function fb(lang: ConversationLanguage) {
  if (lang === "en") {
    return {
      error: "Just a moment.",
      noContext: "Hello. What model are you looking for?",
      timeout: "One moment please.",
      apiError: "Let me check that.",
    };
  }
  if (lang === "es") {
    return {
      error: "Un momento, por favor.",
      noContext: "Hola. ¿Qué modelo busca?",
      timeout: "Un instante, por favor.",
      apiError: "Un momento señor, estoy verificando eso.",
    };
  }
  return {
    error: "Je vérifie.",
    noContext: "Bonjour. Dites-moi juste le modèle que vous cherchez.",
    timeout: "Un instant s'il vous plaît.",
    apiError: "Je regarde cela Monsieur.",
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
      language: z.enum(["fr", "en", "es"]).optional(),
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
    const rawMsg = String((json as any)?.message ?? "");
    const lang = detectConversationLanguage({
      message: rawMsg,
      previous: (json as any)?.conversation_state?.language,
      history: typeof json === "object" && json ? recentChatFromRequest({ message: rawMsg, clientHistory: (json as any)?.history }) : undefined,
    });
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

  const earlyLang = detectConversationLanguage({
    message,
    previous: conversation_state?.language as ConversationLanguage | undefined,
    history: recentChatFromRequest({ message, clientHistory }),
  });
  const earlyFb = fb(earlyLang);

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
      return NextResponse.json({ success: true, reply: earlyFb.error, error: "AGENT_NOT_FOUND" }, { status: 200 });
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
      try {
        const { error: delFuErr } = await admin.from("pending_agent_followups").delete().eq("conversation_id", conv.id);
        if (delFuErr) console.error("[CHAT_METADATA_UPDATE_FAILED] pending_agent_followups delete", delFuErr);
      } catch (err) {
        console.error("[CHAT_METADATA_UPDATE_FAILED] pending_agent_followups delete throw", err);
      }
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

    const nowIso = new Date().toISOString();
    const history = (Array.isArray(conv?.messages) ? (conv?.messages as any[]) : []) as StoredMessage[];
    const historyMsgs =
      Array.isArray(clientHistory) && clientHistory.length > 0
        ? clientHistory.slice(-11).map((m) => ({ role: m.role, content: m.content }))
        : history.slice(-11).map((m) => ({ role: m.role, content: m.content }));
    const recentChatForMerge = [...historyMsgs, { role: "user" as const, content: message }];

    const { state: behaviorState, intent: detectedIntent } = mergeSellerBehaviorStateForUserTurn({
      previous: mergedBase,
      message,
      recentChat: recentChatForMerge,
    });

    const lang = behaviorState.language ?? "en";
    const FALLBACK_ERROR_REPLY = fb(lang).error;
    const FALLBACK_NO_CONTEXT_REPLY = fb(lang).noContext;
    const nextHistory: StoredMessage[] = [...history, { role: "user", content: message, ts: nowIso }];

    const detectedStatus = detectStatusFromUserMessage(message);

    let reply = FALLBACK_NO_CONTEXT_REPLY;
    try {
      const modelHistory = Array.isArray(clientHistory)
        ? clientHistory.slice(-10)
        : history.slice(-10).map((m) => ({ role: m.role, content: m.content }));

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
    const preview = reply.slice(0, 120);
    const aiIso = new Date().toISOString();
    if (!convId) {
      const insertFull: Record<string, unknown> = {
        agent_id,
        session_id,
        messages: nextHistory as any,
        conversation_state: conversationStateOut as any,
        status: statusNext,
        last_message_at: nowIso,
        last_user_message_at: nowIso,
        last_ai_message_at: aiIso,
        last_message_preview: preview,
        relance_count: 0,
        next_relance_at: shouldClose ? null : nextRelanceAt,
        updated_at: aiIso,
      };
      try {
        const { data: inserted, error: insErr } = await conversationsInsertWithOptionalColumnFallback(admin, insertFull);
        if (insErr) console.error("[CHAT_METADATA_UPDATE_FAILED] conversations insert final", insErr);
        convId = (inserted as { id?: string } | null)?.id ?? null;
      } catch (err) {
        console.error("[CHAT_METADATA_UPDATE_FAILED] conversations insert throw", err);
      }
    } else {
      const updateFull: Record<string, unknown> = {
        status: statusNext,
        last_message_at: nowIso,
        last_user_message_at: nowIso,
        last_ai_message_at: aiIso,
        last_message_preview: preview,
        relance_count: 0,
        next_relance_at: shouldClose ? null : nextRelanceAt,
        messages: nextHistory as any,
        conversation_state: conversationStateOut as any,
        updated_at: aiIso,
      };
      try {
        const { error: upErr } = await conversationsUpdateWithOptionalColumnFallback(admin, convId, updateFull);
        if (upErr) console.error("[CHAT_METADATA_UPDATE_FAILED] conversations update final", upErr);
      } catch (err) {
        console.error("[CHAT_METADATA_UPDATE_FAILED] conversations update throw", err);
      }
    }

    if (convId && isAgentHoldReply(reply)) {
      try {
        const { error: fuErr } = await admin.from("pending_agent_followups").insert({
          conversation_id: convId,
          scheduled_for: new Date(Date.now() + followupDelayMs(detectedIntent)).toISOString(),
          status: "pending",
          payload: { lastUserMessage: message, lang, conversationState: conversationStateOut, personaKey: (agent as any).persona_key ?? persona.id },
        } as any);
        if (fuErr) console.error("[CHAT_METADATA_UPDATE_FAILED] pending_agent_followups insert", fuErr);
      } catch (err) {
        console.error("[CHAT_METADATA_UPDATE_FAILED] pending_agent_followups insert throw", err);
      }
    }

    return NextResponse.json({ success: true, reply, conversation_state: conversationStateOut }, { status: 200 });
  } catch (e) {
    console.error("[OPTIMA_AI_ERROR]", e);
    console.error("[API] Unexpected error:", { message: (e as any)?.message ?? String(e), stack: (e as any)?.stack });
    const lang = detectConversationLanguage({
      message: "",
      previous: (json as any)?.conversation_state?.language as ConversationLanguage | undefined,
    });
    return NextResponse.json({ success: true, reply: fb(lang).error, error: "INTERNAL_ERROR" }, { status: 200 });
  }
}
