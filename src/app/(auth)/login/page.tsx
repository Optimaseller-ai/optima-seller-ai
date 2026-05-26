import { Suspense } from "react";
import { LoginClient } from "@/app/(auth)/login/login-client";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/app");
  } catch {
    // Demo mode: allow page to render without Supabase.
  }
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement...</div>}>
      <LoginClient />
    </Suspense>
  );
}
