import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { openRouterChat, openRouterEmbed } from "@/lib/ai/openrouter";
import { resolveBusinessTimezone } from "@/lib/agents/timing/business-timezone";
import {
  buildPremiumSystemPrompt,
  buildPremiumUserPrompt,
  postProcessPremiumReply,
  quickHumanReply,
  detectDominantLanguage,
  pickHoldReply,
  type PremiumSellerProfile,
} from "@/lib/agents/prompts/premium/seller-prompts";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { detectProspectTurnIntent, salesOpportunityAllowedForIntent } from "@/lib/agents/human-behavior/response-orchestrator";
import { prospectExplicitlyRefusesOrder } from "@/lib/agents/human-behavior/emotions/conversation-emotion";
import { runSalesOpportunityEngine } from "@/lib/agents/sales/opportunity-engine";

const MAX_HISTORY_MESSAGES = 10;
const MAX_CATALOG_PRODUCTS = 6;
const MATCH_CHUNKS_COUNT = 6;
const CONTEXT_CACHE_TTL_MS = 45_000;
const PROFILE_CACHE_TTL_MS = 120_000;

type ProfileCacheEntry = {
  exp: number;
  profileBusinessName: string;
  sector: string;
  city: string;
  country: string;
  tone: unknown;
};

type RagCacheEntry = {
  exp: number;
  topChunks: string;
};

const profileCache = new Map<string, ProfileCacheEntry>();
const ragCache = new Map<string, RagCacheEntry>();

function cacheKeyMsg(userId: string, message: string) {
  return `${userId}:${message.trim().toLowerCase().slice(0, 240)}`;
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function logCtx(event: string, payload: Record<string, unknown>) {
  console.log("[OPTIMA_AI_BUSINESS_CONTEXT]", event, payload);
}

function formatProduct(p: any) {
  const parts: string[] = [];
  parts.push(`- ${p.name}`);
  if (p.price != null) parts.push(`  Prix: ${p.price} FCFA`);
  if (p.promo) parts.push(`  Promo: ${p.promo}`);
  if (p.stock != null) parts.push(`  Stock: ${p.stock}`);
  if (p.category) parts.push(`  Catégorie: ${p.category}`);
  if (p.description) parts.push(`  Description: ${String(p.description).slice(0, 280)}`);
  return parts.join("\n");
}

async function openRouterChatWithOneRetry(messages: Parameters<typeof openRouterChat>[0]["messages"]) {
  try {
    return await openRouterChat({ messages, timeoutMs: 25_000 });
  } catch (e1) {
    console.error("[OPTIMA_AI_ERROR]", e1);
    const msg = e1 instanceof Error ? e1.message : String(e1);
    if (/Missing OPENROUTER_API_KEY/i.test(msg)) throw e1;
    await delay(2000);
    return await openRouterChat({ messages, timeoutMs: 25_000 });
  }
}

export async function generateAIReply(args: {
  message: string;
  userId: string;
  agentName?: string;
  agentPersonality?: "chaleureux" | "professionnel" | "dynamique";
  salesStyle?: "conseiller" | "closer" | "premium";
  businessName?: string;
  conversationState?: SellerBehaviorConversationState;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  agentRole?: string;
  agentTone?: string;
  personaKey?: string | null;
  /** Génération du 2e message après « je vérifie » */
  followupAfterHold?: boolean;
}) {
  const pipelineStart = Date.now();
  logCtx("generate_start", {
    userId: args.userId,
    messageLen: args.message.length,
    historyLen: Array.isArray(args.history) ? args.history.length : 0,
  });

  const admin = createAdminClientSafe();
  if (!admin) {
    console.error("[generateAIReply] No admin client");
    return "Bonjour Monsieur. Dites-moi le modèle ou l’article qui vous intéresse.";
  }

  const { message, userId } = args;
  const history = Array.isArray(args.history) ? args.history.slice(-MAX_HISTORY_MESSAGES) : [];

  let profileBusinessName: string;
  let sector: string;
  let city: string;
  let country: string;
  let tone: unknown;

  const profCached = profileCache.get(userId);
  if (profCached && Date.now() < profCached.exp) {
    profileBusinessName = profCached.profileBusinessName;
    sector = profCached.sector;
    city = profCached.city;
    country = profCached.country;
    tone = profCached.tone;
    logCtx("profile_cache_hit", { userId });
  } else {
    const profStart = Date.now();
    const { data: prof } = await admin
      .from("profiles")
      .select("business_name,business_type,city,country,tone,shop_name")
      .eq("id", userId)
      .maybeSingle();

    profileBusinessName = String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? "").trim() || "Notre boutique";
    sector = String((prof as any)?.business_type ?? "").trim() || "Non spécifié";
    city = String((prof as any)?.city ?? "").trim() || "Non spécifié";
    country = String((prof as any)?.country ?? "").trim();
    tone = (prof as any)?.tone ?? null;

    profileCache.set(userId, {
      exp: Date.now() + PROFILE_CACHE_TTL_MS,
      profileBusinessName,
      sector,
      city,
      country,
      tone,
    });
    logCtx("profile_loaded", { userId, ms: Date.now() - profStart });
  }

  const agentName = String(args.agentName ?? "").trim() || "Service client";
  const agentPersonality = args.agentPersonality ?? "chaleureux";
  const salesStyle = args.salesStyle ?? "conseiller";
  const businessNameFromReq = String(args.businessName ?? "").trim();
  const finalBusinessName = businessNameFromReq || profileBusinessName;

  const tzResolved = resolveBusinessTimezone({ city, country });

  const sellerProfile: PremiumSellerProfile = {
    agentName,
    businessName: finalBusinessName,
    sector,
    city,
    country: country || undefined,
    agentPersonality,
    salesStyle,
    agentRole: args.agentRole?.trim() || undefined,
    agentTone: args.agentTone?.trim() || undefined,
    businessIanaTimezone: tzResolved.iana,
  };

  const quick =
    args.followupAfterHold === true
      ? null
      : quickHumanReply(sellerProfile, {
          message,
          history,
          conversationState: args.conversationState,
        });
  if (quick) {
    logCtx("quick_reply", { userId, ms: Date.now() - pipelineStart });
    return quick;
  }

  const q = message.trim();
  logCtx("catalog_search", { userId, querySnippet: q.slice(0, 40) });

  const { data: matchedProducts } = await admin
    .from("products")
    .select("name,price,category,stock,promo,description,created_at")
    .eq("user_id", userId)
    .ilike("name", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(MAX_CATALOG_PRODUCTS);

  const productsList: any[] = Array.isArray(matchedProducts) ? [...matchedProducts] : [];

  if (productsList.length < MAX_CATALOG_PRODUCTS) {
    const { data: recentProducts } = await admin
      .from("products")
      .select("name,price,category,stock,promo,description,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_CATALOG_PRODUCTS + 8);

    const seen = new Set(productsList.map((p) => String(p?.name ?? "")));
    for (const p of recentProducts ?? []) {
      if (productsList.length >= MAX_CATALOG_PRODUCTS) break;
      const name = String((p as any)?.name ?? "");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      productsList.push(p);
    }
  }

  const topProducts =
    productsList.length > 0 ? productsList.slice(0, MAX_CATALOG_PRODUCTS).map(formatProduct).join("\n") : "";

  logCtx("catalog_resolved", { userId, productCount: Math.min(productsList.length, MAX_CATALOG_PRODUCTS) });

  const ragKey = cacheKeyMsg(userId, q);
  let topChunks = "";
  const ragHit = ragCache.get(ragKey);
  if (ragHit && Date.now() < ragHit.exp) {
    topChunks = ragHit.topChunks;
    logCtx("rag_cache_hit", { userId, chars: topChunks.length });
  } else {
    try {
      const embedT0 = Date.now();
      const embedding = await openRouterEmbed({ input: q });
      logCtx("reply_embed_ok", { userId, ms: Date.now() - embedT0, inputLen: q.length });

      const rpcT0 = Date.now();
      const { data: chunks } = await admin.rpc("match_document_chunks", {
        p_user_id: userId,
        query_embedding: embedding as any,
        match_count: MATCH_CHUNKS_COUNT,
      });
      logCtx("reply_chunks_ok", { userId, ms: Date.now() - rpcT0, count: chunks?.length ?? 0 });

      topChunks =
        Array.isArray(chunks) && chunks.length
          ? chunks
              .map((c: any, i: number) => {
                const text = String(c.content ?? "").slice(0, 900);
                return `- Extrait ${i + 1}:\n${text}`;
              })
              .join("\n\n")
          : "";
      ragCache.set(ragKey, { exp: Date.now() + CONTEXT_CACHE_TTL_MS, topChunks });
    } catch (e) {
      console.error("[OPTIMA_AI_ERROR]", e);
      logCtx("reply_rag_failed", { userId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const langForSales = detectDominantLanguage({ message, previous: args.conversationState?.language });
  const prospectTurnIntent = detectProspectTurnIntent(message);

  let salesOpportunityBlock: string | undefined;
  if (!args.followupAfterHold && salesOpportunityAllowedForIntent(prospectTurnIntent) && !prospectExplicitlyRefusesOrder(message)) {
    const salesOpp = runSalesOpportunityEngine({
      message,
      history,
      conversationProfile: args.conversationState?.conversationProfile,
      productMemory: args.conversationState?.productMemory,
      commercialMemory: args.conversationState?.commercialMemory,
      lastIntent: args.conversationState?.lastSellerIntent,
      productsText: topProducts,
    });
    salesOpportunityBlock = langForSales === "en" ? salesOpp.promptBlockEn : salesOpp.promptBlockFr;
  }

  const systemPrompt = buildPremiumSystemPrompt(sellerProfile, {
    message,
    history,
    followupAfterHold: args.followupAfterHold === true,
    conversationState: args.conversationState,
    personaKey: args.personaKey ?? null,
    productsText: topProducts,
    chunksText: topChunks,
    salesOpportunityBlock,
    prospectTurnIntent,
  });
  const userPrompt = buildPremiumUserPrompt(sellerProfile, {
    message,
    history,
    followupAfterHold: args.followupAfterHold === true,
    conversationState: args.conversationState,
    personaKey: args.personaKey ?? null,
    productsText: topProducts,
    chunksText: topChunks,
    salesOpportunityBlock,
    prospectTurnIntent,
  });

  const promptChars = systemPrompt.length + userPrompt.length;
  const estimatedTokens = Math.ceil(promptChars / 4);
  logCtx("prompt_ready", {
    userId,
    promptChars,
    estimatedTokens,
    historyTurns: history.length,
    productsBlockChars: topProducts.length,
    chunksBlockChars: topChunks.length,
    msSinceStart: Date.now() - pipelineStart,
  });

  let cleaned: string;
  try {
    const orStart = Date.now();
    const raw = await openRouterChatWithOneRetry([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
    logCtx("openrouter_total_ok", { userId, ms: Date.now() - orStart });
    cleaned = postProcessPremiumReply(raw, {
      microSeed: message + userId,
      repliesSinceLastEmoji: args.conversationState?.conversationalEtiquette?.repliesSinceLastEmoji ?? 7,
      lastUserMessage: message,
      businessIanaTimezone: sellerProfile.businessIanaTimezone,
      city: sellerProfile.city,
      country: sellerProfile.country,
      conversationState: args.conversationState,
    });
  } catch (e2) {
    console.error("[OPTIMA_AI_ERROR]", e2);
    const lang = detectDominantLanguage({ message, previous: args.conversationState?.language });
    cleaned = pickHoldReply(lang, message + userId);
    logCtx("openrouter_failed_hold_reply", {
      userId,
      lang,
      error: e2 instanceof Error ? e2.message : String(e2),
    });
  }

  logCtx("generate_done", { userId, replyLen: cleaned.length, ms: Date.now() - pipelineStart });
  return cleaned;
}
