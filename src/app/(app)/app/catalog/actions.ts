"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  indexProductKnowledge,
  removeProductKnowledgeIndex,
  reindexAllProductsForUser,
} from "@/lib/business-knowledge/catalog/product-indexer";

export async function addProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" };

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", auth.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return { ok: false as const, message: "PRO_REQUIRED" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const promo = String(formData.get("promo") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();

  if (!name) return { ok: false as const, message: "NAME_REQUIRED" };
  if (!description) return { ok: false as const, message: "DESCRIPTION_REQUIRED" };

  const price = priceRaw ? Number(priceRaw) : null;
  const stock = stockRaw ? Number(stockRaw) : null;

  const { data: inserted, error } = await supabase
    .from("products")
    .insert({
      user_id: auth.user.id,
      name,
      description,
      category,
      promo,
      price: Number.isFinite(price as any) ? price : null,
      stock: Number.isFinite(stock as any) ? stock : null,
    } as any)
    .select("id")
    .single();

  if (error) {
    console.error("addProduct insert error:", error);
    return { ok: false as const, message: "SAVE_FAILED" };
  }

  if (inserted?.id) {
    await indexProductKnowledge({
      userId: auth.user.id,
      productId: String(inserted.id),
      name,
      description,
      category,
      promo,
      price: Number.isFinite(price as any) ? (price as number) : null,
      stock: Number.isFinite(stock as any) ? (stock as number) : null,
    });
  }

  revalidatePath("/app/catalog");
  return { ok: true as const };
}

export async function updateProduct(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" };

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", auth.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return { ok: false as const, message: "PRO_REQUIRED" };

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || null;
  const promo = String(formData.get("promo") ?? "").trim() || null;
  const priceRaw = String(formData.get("price") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  if (!name) return { ok: false as const, message: "NAME_REQUIRED" };

  const price = priceRaw ? Number(priceRaw) : null;
  const stock = stockRaw ? Number(stockRaw) : null;

  const { error } = await supabase
    .from("products")
    .update({
      name,
      description,
      category,
      promo,
      price: Number.isFinite(price as any) ? price : null,
      stock: Number.isFinite(stock as any) ? stock : null,
    } as any)
    .eq("id", productId)
    .eq("user_id", auth.user.id);

  if (error) return { ok: false as const, message: "SAVE_FAILED" };

  await indexProductKnowledge({
    userId: auth.user.id,
    productId,
    name,
    description,
    category,
    promo,
    price: Number.isFinite(price as any) ? (price as number) : null,
    stock: Number.isFinite(stock as any) ? (stock as number) : null,
  });

  revalidatePath("/app/catalog");
  return { ok: true as const };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" };

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", auth.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return { ok: false as const, message: "PRO_REQUIRED" };

  const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", auth.user.id);
  if (error) {
    console.error("deleteProduct error:", error);
    return { ok: false as const, message: "DELETE_FAILED" };
  }
  await removeProductKnowledgeIndex(productId);
  revalidatePath("/app/catalog");
  return { ok: true as const };
}

export async function reindexCatalogKnowledge() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" };

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", auth.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") return { ok: false as const, message: "PRO_REQUIRED" };

  const count = await reindexAllProductsForUser(auth.user.id);
  revalidatePath("/app/catalog");
  return { ok: true as const, count };
}
