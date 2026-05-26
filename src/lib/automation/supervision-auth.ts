import "server-only";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export type SupervisionAuthOk = { ok: true; userId: string | null };

export async function ensureSupervisorSession(): Promise<SupervisionAuthOk | Response> {
  const hasSupabase = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasSupabase) {
    return { ok: true, userId: null };
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  return { ok: true, userId: data.user.id };
}
