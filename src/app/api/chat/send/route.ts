import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAIReply } from "@/lib/ai/business-context";
import { detectStatusFromUserMessage, getNextRelanceAt, isClosedStatus } from "@/lib/chat/relance";

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
        error: "One moment please. I’m checking and I’ll get back to you.",
        noContext: "Hello. What model are you looking for?",
        timeout: "Just a moment… it’s a bit slow. Please try again in 10 seconds.",
        apiError: "Small delay. Please try again in a moment.",
      }
    : {
        error: "Un instant Monsieur/Madame. Je vérifie et je reviens.",
        noContext: "Bonjour. Dites-moi juste le modèle que vous cherchez.",
        timeout: "Un instant… c’est un peu lent. Réessayez dans 10 secondes.",
        apiError: "Petite lenteur. Réessayez dans un instant.",
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
    .max(5)
    .optional(),
  conversation_state: z
    .object({
      language: z.enum(["fr", "en"]).optional(),
      preferences: z
        .object({
          blacklist: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
        })
        .optional(),
      mood: z.string().trim().min(1).max(40).optional(),
      memory: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
      tone_mode: z.enum(["chill", "premium", "vendeur_soft", "support_client", "conversation_naturelle"]).optional(),
    })
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
      .select("id,user_id,is_active,name,slug")
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

    const { data: conv } = await admin
      .from("conversations")
      .select("id,messages,status,relance_count")
      .eq("agent_id", agent_id)
      .eq("session_id", session_id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const history = (Array.isArray(conv?.messages) ? (conv?.messages as any[]) : []) as StoredMessage[];
    const nextHistory: StoredMessage[] = [...history, { role: "user", content: message, ts: nowIso }];

    const detectedStatus = detectStatusFromUserMessage(message);

    let reply = FALLBACK_NO_CONTEXT_REPLY;
    try {
      const modelHistory = Array.isArray(clientHistory)
        ? clientHistory
        : history.slice(-5).map((m) => ({ role: m.role, content: m.content }));
      
      console.log("[API] Calling generateAIReply...", { 
        message: message.slice(0, 50) + "...", 
        historyLength: modelHistory.length 
      });
      
      reply = await generateAIReply({
        message,
        userId: agent.user_id,
        agentName: agent_name || agent.name || "Service client",
        agentPersonality: agent_personality,
        businessName: business_name,
        salesStyle: sales_style,
        history: modelHistory,
        conversationState: conversation_state,
      });
      
      console.log("[API] AI reply generated:", { replyLength: reply.length, reply: reply.slice(0, 100) });
    } catch (e) {
      console.error("[API] generateAIReply error:", { message: (e as any)?.message ?? String(e) });
      reply = FALLBACK_NO_CONTEXT_REPLY;
    }

    console.log("[API] Final reply:", { replyLength: reply.length, reply });

    nextHistory.push({ role: "assistant", content: reply, ts: new Date().toISOString() });

    const statusNext = detectedStatus ?? (typeof conv?.status === "string" ? (conv.status as string) : "active");
    const shouldClose = isClosedStatus(statusNext);
    const nextRelanceAt = shouldClose
      ? null
      : getNextRelanceAt({ relanceCount: typeof conv?.relance_count === "number" ? conv.relance_count : 0, from: new Date() });

    if (!conv?.id) {
      await admin.from("conversations").insert({
        agent_id,
        session_id,
        messages: nextHistory as any,
        status: statusNext,
        last_message_at: nowIso,
        last_user_message_at: nowIso,
        last_ai_message_at: new Date().toISOString(),
        relance_count: 0,
        next_relance_at: shouldClose ? null : nextRelanceAt,
        updated_at: new Date().toISOString(),
      });
    } else {
      await admin
        .from("conversations")
        .update({
          status: statusNext,
          last_message_at: nowIso,
          last_user_message_at: nowIso,
          last_ai_message_at: new Date().toISOString(),
          relance_count: 0,
          next_relance_at: shouldClose ? null : nextRelanceAt,
          messages: nextHistory as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conv.id);
    }

    return NextResponse.json({ success: true, reply }, { status: 200 });
  } catch (e) {
    console.error("[API] Unexpected error:", { message: (e as any)?.message ?? String(e), stack: (e as any)?.stack });
    const lang = detectLangFromMessageAndState({ message: "", stateLang: (json as any)?.conversation_state?.language });
    return NextResponse.json({ success: true, reply: fb(lang).error, error: "INTERNAL_ERROR" }, { status: 200 });
  }
}
