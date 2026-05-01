"use client";

import { createClient } from "@/lib/supabase/client";

export function createOptionalSupabaseClient() {
  try {
    return createClient();
  } catch {
    return null;
  }
}

