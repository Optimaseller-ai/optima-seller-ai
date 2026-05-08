import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { openRouterChat, openRouterEmbed } from "@/lib/ai/openrouter";
import {
  buildPremiumSystemPrompt,
  buildPremiumUserPrompt,
  postProcessPremiumReply,
  quickHumanReply,
  type PremiumSellerProfile,
} from "@/lib/ai/premium-seller";

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

export async function getBusinessContext(userId: string, query: string) {
  const admin = createAdminClientSafe();
  if (!admin) return { kind: "empty" as const, context: "" };
  const q = query.trim();
  if (!q) return { kind: "empty" as const, context: "" };

  const { data: products, error: prodErr } = await admin
    .from("products")
    .select("id,name,price,category,stock,promo,description")
    .eq("user_id", userId)
    .ilike("name", `%${q}%`)
    .limit(10);

  if (prodErr) console.error("getBusinessContext products error:", prodErr);
  if (products && products.length > 0) {
    return { kind: "products" as const, context: ["Produits:", ...products.map(formatProduct)].join("\n") };
  }

  try {
    const embedding = await openRouterEmbed({ input: q });
    const { data: chunks, error: chunkErr } = await admin.rpc("match_document_chunks", {
      p_user_id: userId,
      query_embedding: embedding as any,
      match_count: 5,
    });
    if (chunkErr) console.error("getBusinessContext match_document_chunks error:", chunkErr);

    const excerpt =
      Array.isArray(chunks) && chunks.length
        ? chunks
            .map((c: any, i: number) => {
              const text = String(c.content ?? "").slice(0, 1400);
              return `- Extrait ${i + 1}:\n${text}`;
            })
            .join("\n\n")
        : "";

    return { kind: "documents" as const, context: excerpt ? `Documents (extraits pertinents):\n${excerpt}` : "" };
  } catch (e) {
    console.error("getBusinessContext embeddings error:", e);
    return { kind: "documents" as const, context: "" };
  }
}

export async function generateAIReply(args: {
  message: string;
  userId: string;
  agentName?: string;
  agentPersonality?: "chaleureux" | "professionnel" | "dynamique";
  salesStyle?: "conseiller" | "closer" | "premium";
  businessName?: string;
  conversationState?: {
    language?: "fr" | "en";
    preferences?: { blacklist?: string[] };
    mood?: string;
    memory?: string[];
    tone_mode?: "chill" | "premium" | "vendeur_soft" | "support_client" | "conversation_naturelle";
    stats?: { turn_count?: number; fatigue?: number; last_active_at?: number };
  };
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  console.log("[generateAIReply] Starting...", { message: args.message.slice(0, 30), userId: args.userId });
  
  const admin = createAdminClientSafe();
  if (!admin) {
    console.error("[generateAIReply] No admin client");
    return "Oui Monsieur/Madame. Quel produit ou service recherchez-vous, s'il vous plaît ?";
  }

  const { message, userId } = args;

  const { data: prof } = await admin
    .from("profiles")
    .select("business_name,business_type,city,tone,shop_name")
    .eq("id", userId)
    .maybeSingle();

  const profileBusinessName = String((prof as any)?.business_name ?? (prof as any)?.shop_name ?? "").trim() || "Notre boutique";
  const sector = String((prof as any)?.business_type ?? "").trim() || "Non spécifié";
  const city = String((prof as any)?.city ?? "").trim() || "Non spécifié";
  const tone = (prof as any)?.tone ?? null;

  const agentName = String(args.agentName ?? "").trim() || "Service client";
  const agentPersonality = args.agentPersonality ?? "chaleureux";
  const salesStyle = args.salesStyle ?? "conseiller";
  const businessNameFromReq = String(args.businessName ?? "").trim();
  const finalBusinessName = businessNameFromReq || profileBusinessName;

  const sellerProfile: PremiumSellerProfile = {
    agentName,
    businessName: finalBusinessName,
    sector,
    city,
    agentPersonality,
    salesStyle,
  };

  const history = Array.isArray(args.history) ? args.history.slice(-5) : [];

  // Deterministic human replies for the biggest "AI giveaway" cases.
  const quick = quickHumanReply(sellerProfile, {
    message,
    history,
    conversationState: args.conversationState,
  });
  if (quick) return quick;

  // Prefer real products matching the message; never propose more than 2.
  const q = message.trim();
  console.log("[generateAIReply] Searching products...", { query: q.slice(0, 30) });
  
  const { data: matchedProducts } = await admin
    .from("products")
    .select("name,price,category,stock,promo,description,created_at")
    .eq("user_id", userId)
    .ilike("name", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(2);

  console.log("[generateAIReply] Products found:", { matched: matchedProducts?.length ?? 0 });

  const { data: recentProducts } =
    Array.isArray(matchedProducts) && matchedProducts.length
      ? ({ data: [] } as any)
      : await admin
          .from("products")
          .select("name,price,category,stock,promo,description,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(2);

  const products = (Array.isArray(matchedProducts) && matchedProducts.length ? matchedProducts : recentProducts) as any[];
  const topProducts = Array.isArray(products) && products.length ? products.slice(0, 2).map(formatProduct).join("\n") : "";

  let topChunks = "";
  try {
    console.log("[generateAIReply] Generating embeddings...");
    const embedding = await openRouterEmbed({ input: message.trim() });
    console.log("[generateAIReply] Matching chunks...");
    
    const { data: chunks } = await admin.rpc("match_document_chunks", {
      p_user_id: userId,
      query_embedding: embedding as any,
      match_count: 5,
    });
    
    console.log("[generateAIReply] Chunks matched:", { count: chunks?.length ?? 0 });
    
    topChunks =
      Array.isArray(chunks) && chunks.length
        ? chunks
            .map((c: any, i: number) => {
              const text = String(c.content ?? "").slice(0, 1000);
              return `- Extrait ${i + 1}:\n${text}`;
            })
            .join("\n\n")
        : "";
  } catch (e) {
    console.error("[generateAIReply] Embeddings error:", { message: (e as any)?.message });
  }

  const systemPrompt = buildPremiumSystemPrompt(sellerProfile, {
    message,
    history,
    conversationState: args.conversationState,
    productsText: topProducts,
    chunksText: topChunks,
  });
  const userPrompt = buildPremiumUserPrompt(sellerProfile, {
    message,
    history,
    conversationState: args.conversationState,
    productsText: topProducts,
    chunksText: topChunks,
  });

  console.log("[generateAIReply] Calling OpenRouter...");
  const result = await openRouterChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  
  const cleaned = postProcessPremiumReply(result);
  console.log("[generateAIReply] Final result:", { length: cleaned.length, preview: cleaned.slice(0, 80) });
  return cleaned;
}

