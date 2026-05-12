import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { openRouterEmbed } from "@/lib/ai/openrouter";

const MAX_CATALOG_PRODUCTS = 6;
const MATCH_CHUNKS_COUNT = 6;

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

/** Catalogue produits + RAG documents — contexte métier pour prompts / relances. */
export async function getBusinessContext(userId: string, query: string) {
  const started = Date.now();
  const admin = createAdminClientSafe();
  if (!admin) {
    logCtx("empty_no_admin", { userId, ms: Date.now() - started });
    return { kind: "empty" as const, context: "" };
  }
  const q = query.trim();
  if (!q) {
    logCtx("empty_query", { userId, ms: Date.now() - started });
    return { kind: "empty" as const, context: "" };
  }

  const { data: products, error: prodErr } = await admin
    .from("products")
    .select("id,name,price,category,stock,promo,description")
    .eq("user_id", userId)
    .ilike("name", `%${q}%`)
    .limit(MAX_CATALOG_PRODUCTS);

  if (prodErr) console.error("[OPTIMA_AI_BUSINESS_CONTEXT] products_error", prodErr);
  if (products && products.length > 0) {
    logCtx("products_hit", {
      userId,
      ms: Date.now() - started,
      count: products.length,
      queryLen: q.length,
    });
    return { kind: "products" as const, context: ["Produits:", ...products.map(formatProduct)].join("\n") };
  }

  try {
    const embedT0 = Date.now();
    const embedding = await openRouterEmbed({ input: q });
    logCtx("embed_done", { userId, ms: Date.now() - embedT0, queryLen: q.length });

    const rpcT0 = Date.now();
    const { data: chunks, error: chunkErr } = await admin.rpc("match_document_chunks", {
      p_user_id: userId,
      query_embedding: embedding as any,
      match_count: MATCH_CHUNKS_COUNT,
    });
    if (chunkErr) console.error("[OPTIMA_AI_BUSINESS_CONTEXT] match_chunks_error", chunkErr);

    logCtx("chunks_done", {
      userId,
      ms: Date.now() - rpcT0,
      chunkCount: Array.isArray(chunks) ? chunks.length : 0,
    });

    const excerpt =
      Array.isArray(chunks) && chunks.length
        ? chunks
            .map((c: any, i: number) => {
              const text = String(c.content ?? "").slice(0, 1400);
              return `- Extrait ${i + 1}:\n${text}`;
            })
            .join("\n\n")
        : "";

    logCtx("documents_built", { userId, ms: Date.now() - started, excerptChars: excerpt.length });
    return { kind: "documents" as const, context: excerpt ? `Documents (extraits pertinents):\n${excerpt}` : "" };
  } catch (e) {
    console.error("[OPTIMA_AI_ERROR]", e);
    logCtx("embed_or_chunks_failed", {
      userId,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    });
    return { kind: "documents" as const, context: "" };
  }
}
