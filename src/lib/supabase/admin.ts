import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createAdminClient() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase env. Set SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
