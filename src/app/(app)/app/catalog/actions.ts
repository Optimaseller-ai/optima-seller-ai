"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addProduct(formData: FormData) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" };

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

  const { error } = await supabase.from("products").insert({
    user_id: auth.user.id,
    name,
    description,
    category,
    promo,
    price: Number.isFinite(price as any) ? price : null,
    stock: Number.isFinite(stock as any) ? stock : null,
  } as any);

  if (error) {
    console.error("addProduct insert error:", error);
    return { ok: false as const, message: "SAVE_FAILED" };
  }
  revalidatePath("/app/catalog");
  return { ok: true as const };
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false as const, message: "UNAUTHORIZED" };

  const { error } = await supabase.from("products").delete().eq("id", productId).eq("user_id", auth.user.id);
  if (error) {
    console.error("deleteProduct error:", error);
    return { ok: false as const, message: "DELETE_FAILED" };
  }
  revalidatePath("/app/catalog");
  return { ok: true as const };
}
