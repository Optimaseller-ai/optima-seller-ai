import "server-only";

import { createAdminClientSafe } from "@/lib/supabase/admin";
import { openRouterChat } from "@/lib/ai/openrouter";

function formatProduct(p: any) {
  const parts: string[] = [];
  parts.push(`- ${p.name}`);
  if (p.price != null) parts.push(`  Prix: ${p.price}`);
  if (p.promo) parts.push(`  Promo: ${p.promo}`);
  if (p.stock != null) parts.push(`  Stock: ${p.stock}`);
  if (p.category) parts.push(`  Catégorie: ${p.category}`);
  if (p.description) parts.push(`  Description: ${p.description}`);
  return parts.join("\n");
}

export async function getBusinessContext(userId: string, query: string) {
  const admin = createAdminClientSafe();
  if (!admin) {
    // In local/dev envs without service role key, we can't query by userId securely here.
    return { kind: "empty" as const, context: "" };
  }
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

  const { data: docs, error: docErr } = await admin
    .from("documents")
    .select("id,file_name,content,created_at")
    .eq("user_id", userId)
    .ilike("content", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  if (docErr) console.error("getBusinessContext documents error:", docErr);

  const excerpt =
    Array.isArray(docs) && docs.length
      ? docs
          .map((d: any, i: number) => {
            const text = String(d.content ?? "").slice(0, 1400);
            return `- Document ${i + 1} (${d.file_name ?? "document"}):\n${text}`;
          })
          .join("\n\n")
      : "";

  return { kind: "documents" as const, context: excerpt ? `Documents:\n${excerpt}` : "" };
}

export async function generateAIReply(message: string, userId: string) {
  const ctx = await getBusinessContext(userId, message);
  const context = ctx.context || "Aucune information disponible.";

  const content = await openRouterChat({
    messages: [
      { role: "system", content: "Tu es un assistant commercial WhatsApp." },
      {
        role: "user",
        content: [
          "Utilise uniquement les informations suivantes :",
          context,
          "",
          "Règles :",
          "- répondre clairement",
          "- proposer un produit si pertinent",
          "- inclure le prix si disponible",
          "- proposer une action (acheter, réserver, etc.)",
          "",
          "Message client:",
          message,
        ].join("\n"),
      },
    ],
  });
  return content;
}
