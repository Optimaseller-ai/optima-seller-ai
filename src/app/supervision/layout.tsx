import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";

export default async function SupervisionLayout({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return <AppShell>{children}</AppShell>;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login?next=/supervision");

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile?.onboarding_completed) redirect("/onboarding");
  } catch {
    // table absente ou politiques pas prêtes
  }

  return <AppShell initialUserId={data.user.id}>{children}</AppShell>;
}
