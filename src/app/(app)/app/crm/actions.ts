"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const statusSchema = z.enum(["new", "interested", "won", "lost"]);

export async function createProspect(raw: unknown) {
  const schema = z.object({
    name: z.string().min(2),
    phone: z.string().min(6).optional(),
    notes: z.string().optional(),
  });

  const input = schema.parse(raw);

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Connexion requise.");

  const { data, error } = await supabase
    .from("prospects")
    .insert({
      user_id: user.user.id,
      name: input.name,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      status: "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateProspectStatus(raw: unknown) {
  const schema = z.object({
    id: z.string().min(1),
    status: statusSchema,
  });

  const input = schema.parse(raw);

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Connexion requise.");

  const { error } = await supabase
    .from("prospects")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.user.id);

  if (error) throw error;
  return { ok: true };
}

export async function updateProspectNotes(raw: unknown) {
  const schema = z.object({
    id: z.string().min(1),
    notes: z.string().optional(),
  });
  const input = schema.parse(raw);

  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Connexion requise.");

  const { error } = await supabase
    .from("prospects")
    .update({ notes: input.notes ?? null, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.user.id);

  if (error) throw error;
  return { ok: true };
}
