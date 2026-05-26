import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupClient } from "@/app/(auth)/signup/signup-client";

export default async function SignupPage() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/app");
  } catch {
    // If Supabase isn't configured, keep page accessible in demo mode.
  }

  return <SignupClient />;
}

