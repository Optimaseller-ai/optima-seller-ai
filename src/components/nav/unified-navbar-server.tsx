import { UnifiedNavbar } from "@/components/nav/unified-navbar";
import { createClient } from "@/lib/supabase/server";

export async function UnifiedNavbarServer() {
  // Demo mode: if Supabase env isn't configured, render navbar in guest mode.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <UnifiedNavbar />;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return <UnifiedNavbar initialUserId={data.user?.id ?? null} />;
  } catch {
    return <UnifiedNavbar />;
  }
}

