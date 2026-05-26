import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WhatsAppIntegrationClient } from "@/app/(app)/app/integrations/whatsapp/whatsapp-client";

export default async function WhatsAppIntegrationPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/integrations/whatsapp");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if ((sub?.plan ?? "free") !== "pro") redirect("/pricing");

  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("phone_number_id,business_account_id,auto_reply_enabled,paused,human_needed,updated_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  return <WhatsAppIntegrationClient initial={conn ?? null} />;
}

