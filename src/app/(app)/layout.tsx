import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Demo mode: if Supabase env isn't configured, keep everything accessible.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return <AppShell>{children}</AppShell>;
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login?next=/app");

  // Onboarding gate: if profile not completed, send to onboarding.
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) redirect("/onboarding");
  } catch {
    // If table/policies aren't ready yet, don't block the user.
  }

  return <AppShell initialUserId={data.user.id}>{children}</AppShell>;
}
