import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBusinessTimezone } from "@/lib/ai/businessTimezoneResolver";
import { detectConversationLanguage, type ConversationLanguage } from "@/lib/ai/language-detection";
import { generateAIReplyUnified, type GenerateAIReplyResult } from "@/lib/ai/business-context";
import { followupDelayMs, isAgentHoldReply } from "@/lib/chat/agent-hold";
import { resolvePublicPersonaForAgent } from "@/lib/chat/commercial-agents";
import { detectStatusFromUserMessage, getNextRelanceAt, isClosedStatus } from "@/lib/chat/relance";
import {
  conversationsInsertWithOptionalColumnFallback,
  conversationsUpdateWithOptionalColumnFallback,
  isMissingConversationStateColumn,
} from "@/lib/chat/conversation-state-db";
import { mergeSellerBehaviorStateAfterAssistant } from "@/lib/chat/seller-behavior-state";
import { processConversationAutomation } from "@/lib/automation/workflows/conversation-automation";
import { isAiSilentForTakeover, readTakeoverMode } from "@/lib/supervision/conversation-takeover";
import { buildAutomationStateSnapshot, syncAutomationMemory } from "@/lib/automation/memory-sync/memory-sync-engine";
import { sanitizeHoldReply } from "@/lib/agents/social";
import {
  ConversationPipelineDebugger,
  assemblePersistedConversationState,
  beginReplyTurn,
  ensureHumanFallbackReply,
  extractAutomationSlice,
  extractConversationMemorySlice,
  extractHumanStateSlice,
  getContextualFallback,
  finalizeChatSendResponse,
  isActiveReplyTurn,
  jsonSafe,
  releaseReplyTurn,
  runUserTurnPipeline,
  safeEngineExecute,
  safeEngineExecuteSync,
} from "@/lib/chat/pipeline";
import { fetchAgentWithRetry } from "@/lib/chat/agent-session-cache";
import { dedupeThreadMessages } from "@/lib/chat/dedupe-thread-messages";
import { logOpenRouterProxyConfigOnce } from "@/lib/ai/openrouter-proxy-config";

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

function pipelineLang(lang: ConversationLanguage): "fr" | "en" | "es" {
  return lang === "en" ? "en" : lang === "es" ? "es" : "fr";
}

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  request_id: z.string().trim().min(8).max(120).optional(),
  agent_id: z.string().uuid(),
  session_id: z.string().trim().min(8).max(200),
  agent_name: z.string().trim().min(2).max(60).optional(),
  agent_personality: z.enum(["chaleureux", "professionnel", "dynamique"]).optional(),
  business_name: z.string().trim().min(2).max(120).optional(),
  sales_style: z.enum(["conseiller", "closer", "premium"]).optional(),
  user_sent_voice: z.boolean().optional(),
  user_audio_duration_ms: z.number().optional(),
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
          lastProductFocus: z.string().max(120).optional(),
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
  logOpenRouterProxyConfigOnce();

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
    return NextResponse.json(
      {
        success: false,
        reply: getContextualFallback({
          lang: pipelineLang(lang),
          userMessage: rawMsg,
          agentName: "Conseiller",
          businessName: "notre boutique",
          kind: "neutral",
        }),
        error: "INVALID_REQUEST",
      },
      { status: 200 },
    );
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
    user_sent_voice,
    user_audio_duration_ms,
  } = parsed.data;

  const earlyLang = detectConversationLanguage({
    message,
    previous: conversation_state?.language as ConversationLanguage | undefined,
    history: recentChatFromRequest({ message, clientHistory }),
  });
  const earlyLangCode = pipelineLang(earlyLang);

  console.log("message reçu", message);
  console.log("agent_id", agent_id);
  if (agent_name) console.log("agent_name", agent_name);
  if (agent_personality) console.log("agent_personality", agent_personality);
  if (business_name) console.log("business_name", business_name);
  if (sales_style) console.log("sales_style", sales_style);
  if (conversation_state?.tone_mode) console.log("tone_mode", conversation_state.tone_mode);

  const admin = createAdminClient();

  const pipelineDbg = new ConversationPipelineDebugger(`${session_id}_${Date.now()}`);
  const replyTurn = beginReplyTurn(session_id, message, parsed.success ? parsed.data.request_id : undefined);

  try {
    console.log("[API] Checking agent...", { agent_id });
    const agentLookup = await fetchAgentWithRetry(admin, agent_id);
    const agent = agentLookup.agent;

    if (!agent?.id || !agent.is_active) {
      console.error("[API] Agent not found or inactive", {
        agent_id,
        found: !!agent,
        fromCache: agentLookup.fromCache,
        lookupError: agentLookup.error,
      });
      pipelineDbg.setMeta({ fallbackKind: "neutral", fallbackReason: agentLookup.error ?? "agent_not_found" });
      const holdReply =
        earlyLangCode === "en"
          ? "One moment 🙂"
          : earlyLangCode === "es"
            ? "Un momento 🙂"
            : "Un instant 🙂";
      return NextResponse.json(
        {
          success: true,
          reply: holdReply,
          error: null,
          request_id: replyTurn.requestId,
          agent_lookup_degraded: true,
          pipeline_debug: pipelineDbg.toSnapshot(),
        },
        { status: 200 },
      );
    }

    if (agentLookup.fromCache && agentLookup.error) {
      console.warn("[API] Agent served from cache after lookup error", { error: agentLookup.error });
    }

    console.log("[API] Agent found:", {
      agent_id,
      user_id: agent.user_id,
      name: agent.name,
      fromCache: agentLookup.fromCache,
    });

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

    const userTurn = runUserTurnPipeline({
      previous: mergedBase,
      message,
      recentChat: recentChatForMerge,
      personaKey: (agent as { persona_key?: string }).persona_key ?? persona.id,
      debugger: pipelineDbg,
    });
    let behaviorState = userTurn.state;
    const detectedIntent = userTurn.intent;
    if (userTurn.degraded) {
      pipelineDbg.setMeta({ fallbackKind: "neutral", fallbackReason: "user_turn_merge_degraded" });
    }

    if (user_sent_voice) {
      const { patchConversationStateWithAudioMemory } = await import("@/lib/audio/voice/voice-response-engine");
      behaviorState = patchConversationStateWithAudioMemory(behaviorState as Record<string, unknown>, {
        userSentVoice: true,
        userAudioDurationMs: user_audio_duration_ms,
        hourLocal: DateTime.fromJSDate(new Date()).setZone(relTz).hour,
      }) as typeof behaviorState;
    }

    const lang = behaviorState.language ?? "en";
    const langCode = pipelineLang(lang);
    const nextHistory: StoredMessage[] = [...history, { role: "user", content: message, ts: nowIso }];

    const detectedStatus = detectStatusFromUserMessage(message);

    let reply = getContextualFallback({
      lang: langCode,
      userMessage: message,
      agentName: agent_name || persona.name,
      businessName: business_name || agent.name,
      personaKey: (agent as { persona_key?: string }).persona_key ?? persona.id,
      kind: "discovery",
    });
    let gen: GenerateAIReplyResult & { orchestratorPipelineDebug?: Record<string, unknown> } | undefined;

    const takeoverMode = readTakeoverMode(mergedBase);
    if (isAiSilentForTakeover(takeoverMode)) {
      reply = getContextualFallback({
        lang: langCode,
        userMessage: message,
        agentName: agent_name || persona.name,
        businessName: business_name || agent.name,
        kind: "takeover",
      });
      pipelineDbg.setMeta({ responseMode: "fallback", fallbackKind: "takeover" });
      console.log("[OPTIMA_AI_CHAT_SEND] human_takeover_silent", { session_id, takeoverMode });
    }

    try {
      if (isAiSilentForTakeover(takeoverMode)) {
        throw new Error("HUMAN_TAKEOVER_SKIP_AI");
      }
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
      gen = await generateAIReplyUnified({
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
        sessionId: session_id,
        agentId: agent_id,
        pipelineDebugger: pipelineDbg,
        replyTurn,
        railwayMeta: {
          session_id,
          request_id: replyTurn.requestId,
          pipeline_trace_id: pipelineDbg.traceId,
        },
      });
      if (!isActiveReplyTurn(replyTurn)) {
        console.warn("[OPTIMA_AI_CHAT_SEND] stale_reply_discarded", {
          session_id,
          requestId: replyTurn.requestId,
        });
        return NextResponse.json(
          {
            success: false,
            error: "STALE_REQUEST",
            reply: "",
            request_id: replyTurn.requestId,
            discarded: true,
          },
          { status: 200 },
        );
      }
      reply = gen.reply;

      console.log("[OPTIMA_AI_CHAT_SEND] generate_ok", {
        ms: Date.now() - genT0,
        replyLength: reply.length,
        preview: reply.slice(0, 120),
      });
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      if (msg === "RAILWAY_STALE_REPLY_TURN") {
        console.warn("[OPTIMA_AI_CHAT_SEND] railway_stale_reply_turn", { session_id, requestId: replyTurn.requestId });
        return NextResponse.json(
          {
            success: false,
            error: "STALE_REQUEST",
            reply: "",
            request_id: replyTurn.requestId,
            discarded: true,
          },
          { status: 200 },
        );
      }
      if (msg === "RAILWAY_DUPLICATE_REPLY_REQUEST") {
        console.warn("[OPTIMA_AI_CHAT_SEND] railway_duplicate_reply", { session_id, requestId: replyTurn.requestId });
        return NextResponse.json(
          {
            success: false,
            error: "DUPLICATE_REQUEST",
            reply: "",
            request_id: replyTurn.requestId,
            discarded: true,
          },
          { status: 200 },
        );
      }
      if (msg === "HUMAN_TAKEOVER_SKIP_AI") {
        console.log("[OPTIMA_AI_CHAT_SEND] skipped_ai_human_takeover");
      } else {
        console.error("[OPTIMA_AI_ERROR]", e);
        console.error("[OPTIMA_AI_CHAT_SEND] generate_failed", { message: msg });
        reply = getContextualFallback({
          lang: langCode,
          userMessage: message,
          agentName: agent_name || persona.name,
          businessName: business_name || agent.name,
          personaKey: (agent as { persona_key?: string }).persona_key ?? persona.id,
          kind: "generate_failed",
          frustrationLevel01: behaviorState.prospectEmotionalState?.frustrationLevel,
        });
        pipelineDbg.setMeta({ fallbackKind: "generate_failed", fallbackReason: msg });
      }
    }

    const langSan = langCode;
    const sanitizeRun = await safeEngineExecute({
      engine: "sanitize_hold",
      step: "humanization",
      debugger: pipelineDbg,
      fallback: () => reply,
      run: () =>
        sanitizeHoldReply({
          text: reply,
          lastUserMessage: message,
          agentName: agent_name || persona.name,
          businessName: business_name || agent.name,
          personaKey: (agent as { persona_key?: string }).persona_key ?? persona.id,
          lang: langSan,
          prospectProfile: behaviorState.prospectProfile,
          welcomeAlreadyDelivered: (behaviorState.stats?.turn_count ?? 0) >= 2,
          allowEmoji: (behaviorState.conversationalEtiquette?.repliesSinceLastEmoji ?? 7) >= 7,
        }),
    });
    reply = ensureHumanFallbackReply(sanitizeRun.result ?? reply, {
      lang: langSan,
      userMessage: message,
      agentName: agent_name || persona.name,
      businessName: business_name || agent.name,
      personaKey: (agent as { persona_key?: string }).persona_key ?? persona.id,
      kind: "neutral",
      frustrationLevel01: behaviorState.prospectEmotionalState?.frustrationLevel,
    });

    console.log("[API] Final reply:", { replyLength: reply.length, reply });

    nextHistory.push({ role: "assistant", content: reply, ts: new Date().toISOString() });
    const historyForDb = dedupeThreadMessages(nextHistory) as StoredMessage[];

    const mergeAfterRun = safeEngineExecuteSync({
      engine: "merge_assistant_turn",
      step: "memory",
      debugger: pipelineDbg,
      fallback: () => behaviorState,
      run: () => mergeSellerBehaviorStateAfterAssistant({ state: behaviorState, assistantReply: reply }),
    });
    let conversationStateOut = mergeAfterRun.result ?? behaviorState;

    if (typeof gen !== "undefined" && gen.liveOrchestrator) {
      conversationStateOut = { ...conversationStateOut, liveOrchestrator: gen.liveOrchestrator };
    }

    let automationFollowupAt: string | null = null;
    const { evaluateAutomationEligibility } = await import("@/lib/automation/automation-eligibility-engine");
    const autoEligibility = evaluateAutomationEligibility({
      agentId: agent_id,
      sessionId: session_id,
      conversationId: conv?.id ?? null,
      userId: agent.user_id,
      lastUserMessage: message,
      conversationState: conversationStateOut,
      prospectLead: conversationStateOut.prospectLead,
      agentName: agent_name || persona.name,
      lang: behaviorState.language ?? "fr",
    });

    const automationRun = await safeEngineExecute({
      engine: "automation",
      step: "automation",
      debugger: pipelineDbg,
      fallback: () => null,
      run: async () => {
      if (!autoEligibility.eligible) return null;
      const ownerCity = typeof (ownerProfile as any)?.city === "string" ? (ownerProfile as any).city : undefined;
      const automationResult = await processConversationAutomation({
        agentId: agent_id,
        sessionId: session_id,
        conversationId: conv?.id ?? null,
        userId: agent.user_id,
        lastUserMessage: message,
        lastAssistantReply: reply,
        conversationState: conversationStateOut,
        prospectLead: conversationStateOut.prospectLead,
        businessIanaTimezone: relTz,
        city: ownerCity,
        businessName: business_name || agent.name,
        agentName: agent_name || persona.name,
        lang: behaviorState.language ?? "fr",
        relanceCount: typeof conv?.relance_count === "number" ? conv.relance_count : 0,
        lastProspectActiveAt: behaviorState.stats?.last_active_at ?? Date.now(),
      });

      const memoryPatch = syncAutomationMemory({
        agentId: agent_id,
        sessionId: session_id,
        userId: agent.user_id,
        lastUserMessage: message,
        conversationState: conversationStateOut,
        prospectLead: conversationStateOut.prospectLead,
        pipelineStage: automationResult.pipelineStage,
        leadTemperature: conversationStateOut.prospectLead?.leadTemperature,
        lang: behaviorState.language ?? "fr",
      });

      return {
        followupAt: automationResult.followup.scheduledFor,
        state: {
          ...conversationStateOut,
          ...memoryPatch.conversationStatePatch,
          automation: {
            ...buildAutomationStateSnapshot(
              {
                agentId: agent_id,
                sessionId: session_id,
                userId: agent.user_id,
                lastUserMessage: message,
                conversationState: conversationStateOut,
                pipelineStage: automationResult.pipelineStage,
                leadTemperature: conversationStateOut.prospectLead?.leadTemperature,
              },
              automationResult.pipelineStage,
            ),
            nextFollowupAt: automationResult.followup.scheduledFor,
            lastTrigger: automationResult.followup.trigger ?? undefined,
          },
        },
      };
      },
    });
    pipelineDbg.setMeta({
      automationTriggered: automationRun.result != null && autoEligibility.eligible,
    });
    if (automationRun.result) {
      automationFollowupAt = automationRun.result.followupAt;
      conversationStateOut = automationRun.result.state;
    }

    const statusNext = detectedStatus ?? (typeof conv?.status === "string" ? (conv.status as string) : "active");
    const shouldClose = isClosedStatus(statusNext);
    const nextRelanceAt = shouldClose
      ? null
      : automationFollowupAt ??
        getNextRelanceAt({
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
        messages: historyForDb as any,
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
        messages: historyForDb as any,
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

    let audioDelivery: Awaited<ReturnType<typeof import("@/lib/audio/audio-conversation-engine").processOutboundAgentReply>> | null =
      null;
    try {
      const { processOutboundAgentReply } = await import("@/lib/audio/audio-conversation-engine");
      const lastVoiceAt = (behaviorState as { audioMemory?: { lastVoiceAt?: string } }).audioMemory?.lastVoiceAt;
      audioDelivery = await processOutboundAgentReply({
        assistantText: reply,
        personaKey: (agent as any).persona_key ?? persona.id,
        conversationState: conversationStateOut,
        userMessage: message,
        userSentVoice: user_sent_voice === true,
        lastAgentVoiceAt: lastVoiceAt,
        seed: `${session_id}|${Date.now()}`,
      });
      if (audioDelivery.conversationStatePatch) {
        conversationStateOut = {
          ...conversationStateOut,
          ...audioDelivery.conversationStatePatch,
        } as typeof conversationStateOut;
      }
    } catch (audioErr) {
      console.warn("[AUDIO_REPLY_SKIP]", audioErr);
    }

    void import("@/lib/learning/business-learning-engine")
      .then(({ observeConversationTurn }) =>
        observeConversationTurn({
          businessId: agent.user_id,
          conversationId: convId ?? undefined,
          userMessage: message,
          assistantReply: reply,
          conversationState: conversationStateOut,
          status: statusNext,
          salesStyle: sales_style ?? persona.salesStyle,
          localHour: DateTime.fromJSDate(new Date()).setZone(relTz).hour,
          relanceCount: typeof conv?.relance_count === "number" ? conv.relance_count : 0,
        }),
      )
      .catch((e) => console.warn("[LEARNING_OBSERVE_SKIP]", e));

    const pipelineSnapshot = {
      ...pipelineDbg.toSnapshot(),
      railway_orchestrator_pipeline: gen?.orchestratorPipelineDebug,
      socialOnlyMode: behaviorState.socialOnlyMode?.active === true,
      automationBlockReason: autoEligibility.eligible ? undefined : autoEligibility.blockReason,
      leadClassificationReason: behaviorState.socialOnlyMode?.reason ?? autoEligibility.blockReason,
      replyTransformationChain: (gen?.replyTransformationChain ?? []).map((l) => ({
        step: l.step,
        beforeLen: l.beforeText.length,
        afterLen: l.afterText.length,
        reason: l.transformationReason,
        delta: l.textLengthDelta,
      })),
    };
    const persistedState = assemblePersistedConversationState({
      memory: extractConversationMemorySlice(conversationStateOut),
      human: extractHumanStateSlice(conversationStateOut),
      automation: extractAutomationSlice(conversationStateOut),
      liveOrchestrator: conversationStateOut.liveOrchestrator,
      stats: conversationStateOut.stats,
      preferences: conversationStateOut.preferences,
      regionStyle: conversationStateOut.regionStyle,
      pipelineRuntime: pipelineSnapshot,
    });

    if (!isActiveReplyTurn(replyTurn)) {
      console.warn("[OPTIMA_AI_CHAT_SEND] stale_reply_discarded_pre_send", {
        session_id,
        requestId: replyTurn.requestId,
      });
      return NextResponse.json(
        {
          success: false,
          error: "STALE_REQUEST",
          reply: "",
          request_id: replyTurn.requestId,
          discarded: true,
        },
        { status: 200 },
      );
    }

    const finalized = finalizeChatSendResponse({
      reply,
      pipelineSnapshot,
      fallbackInput: {
        lang: langSan,
        userMessage: message,
        agentName: agent_name || persona.name,
        businessName: business_name || agent.name,
        personaKey: (agent as { persona_key?: string }).persona_key ?? persona.id,
        kind: "neutral",
        frustrationLevel01: behaviorState.prospectEmotionalState?.frustrationLevel,
        welcomeAlreadyDelivered: (behaviorState.stats?.turn_count ?? 0) >= 2,
        allowEmoji: (behaviorState.conversationalEtiquette?.repliesSinceLastEmoji ?? 7) >= 7,
      },
      payload: {
        request_id: replyTurn.requestId,
        reply_source: gen?.replyOwnership?.source ?? (gen ? "openrouter" : "fallback"),
        reply_created_at: gen?.replyOwnership?.createdAt ?? Date.now(),
        user_message: message,
        delivery: audioDelivery?.delivery ?? "text",
        audio_reply: audioDelivery?.audio ?? null,
        audio_timing: audioDelivery?.timing ?? null,
        conversation_state: persistedState,
        pipeline_debug: pipelineSnapshot,
        orchestrator_supervision: gen?.liveOrchestrator
          ? {
              currentGoal: gen.liveOrchestrator.currentGoal,
              conversationStage: gen.liveOrchestrator.conversationStage,
              prospectTemperature: gen.liveOrchestrator.prospectTemperature,
              emotionalState: gen.liveOrchestrator.emotionalState,
              urgencyLevel: gen.liveOrchestrator.urgencyLevel,
              nextPlannedAction: gen.liveOrchestrator.lastAgentAction,
              scheduledFollowupAt: gen.liveOrchestrator.nextFollowupAt,
              workflowTriggered: gen.liveOrchestrator.lastWorkflowTrigger,
              confidenceScore: gen.liveOrchestrator.confidenceScore,
              priorityMode: gen.liveOrchestrator.priorityMode,
            }
          : null,
        insights: gen?.supervisorInsights ?? null,
        emotional_insights: gen?.emotionalSupervisorInsights ?? null,
        personality_insights: gen?.personalitySupervisorInsights ?? null,
        social_insights: gen?.socialSupervisorInsights ?? null,
      },
    });

    console.log("[API] Response finalized:", {
      success: finalized.success,
      replyLength: finalized.reply.length,
      finalized: finalized.finalized,
    });

    try {
      return NextResponse.json(finalized.payload, { status: 200 });
    } catch (jsonErr) {
      console.error("[OPTIMA_AI_ERROR] response_json", jsonErr);
      return NextResponse.json(
        {
          success: true,
          error: null,
          reply: finalized.reply,
          conversation_state: {},
        },
        { status: 200 },
      );
    }
  } catch (e) {
    console.error("[OPTIMA_AI_ERROR]", e);
    console.error("[API] Unexpected error:", { message: (e as any)?.message ?? String(e), stack: (e as any)?.stack });
    const lang = detectConversationLanguage({
      message: String((parsed.success ? parsed.data.message : (json as any)?.message) ?? ""),
      previous: (json as any)?.conversation_state?.language as ConversationLanguage | undefined,
      history:
        parsed.success && Array.isArray(parsed.data.history)
          ? recentChatFromRequest({ message: parsed.data.message, clientHistory: parsed.data.history })
          : undefined,
    });
    pipelineDbg.setMeta({ fallbackKind: "internal_error", fallbackReason: (e as Error)?.message ?? String(e) });
    const failLang = pipelineLang(
      detectConversationLanguage({
        message: String((parsed.success ? parsed.data.message : (json as any)?.message) ?? ""),
        previous: (json as any)?.conversation_state?.language as ConversationLanguage | undefined,
        history:
          parsed.success && Array.isArray(parsed.data.history)
            ? recentChatFromRequest({ message: parsed.data.message, clientHistory: parsed.data.history })
            : undefined,
      }),
    );
    return NextResponse.json(
      {
        success: false,
        reply: getContextualFallback({
          lang: failLang,
          userMessage: String((parsed.success ? parsed.data.message : (json as any)?.message) ?? ""),
          agentName: parsed.success ? (parsed.data.agent_name ?? "Conseiller") : "Conseiller",
          businessName: parsed.success ? (parsed.data.business_name ?? "notre boutique") : "notre boutique",
          kind: "internal_error",
        }),
        error: "INTERNAL_ERROR",
        pipeline_debug: pipelineDbg.toSnapshot(),
      },
      { status: 200 },
    );
  } finally {
    releaseReplyTurn(session_id, replyTurn.requestId);
  }
}
