import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function WhatsAppDashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/whatsapp");

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") redirect("/pricing");

  const { data: conn } = await supabase
    .from("whatsapp_connections")
    .select("phone_number_id,business_account_id,auto_reply_enabled,paused,human_needed,updated_at,created_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const { data: lastInbound } = await supabase
    .from("messages")
    .select("body,created_at")
    .eq("user_id", data.user.id)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const startOfDay = DateTime.now().startOf("day").toISO();
  const { count: messagesToday } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .gte("created_at", startOfDay ?? new Date().toISOString());

  const { count: leadsClosed } = await supabase
    .from("sales_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .eq("kind", "won")
    .gte("created_at", startOfDay ?? new Date().toISOString());

  const connected = Boolean(conn?.phone_number_id);
  const statusLabel = !connected ? "Non connecté" : conn?.human_needed ? "Urgent (humain requis)" : conn?.paused ? "En pause" : "Connecté";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">WhatsApp</h1>
          <p className="mt-1 text-sm text-[var(--brand-navy)]/65">Auto Reply Pro (Cloud API).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="bg-white">
            <Link href="/app/integrations/whatsapp">Configurer</Link>
          </Button>
          <Button asChild className="shadow-sm">
            <Link href="/app/conversations">Voir conversations</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-[var(--brand-navy)]">Statut</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--brand-navy)]/70">
            <div className="text-lg font-semibold text-[var(--brand-navy)]">{statusLabel}</div>
            <div className="mt-1">IA active: {conn?.auto_reply_enabled && !conn?.paused ? "ON" : "OFF"}</div>
            <div>Auto réponse: {conn?.auto_reply_enabled ? "ON" : "OFF"}</div>
          </CardContent>
        </Card>

        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-[var(--brand-navy)]">Numéro connecté</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--brand-navy)]/70">
            <div className="font-semibold text-[var(--brand-navy)]">{connected ? conn?.phone_number_id : "—"}</div>
            <div className="mt-1 text-xs text-[var(--brand-navy)]/55">Phone Number ID (Meta)</div>
          </CardContent>
        </Card>

        <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <CardHeader>
            <CardTitle className="text-[var(--brand-navy)]">Activité</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[var(--brand-navy)]/70">
            <div>Dernier message reçu: {lastInbound?.created_at ? new Date(lastInbound.created_at).toLocaleString("fr-FR") : "—"}</div>
            <div className="mt-1 line-clamp-2 text-xs text-[var(--brand-navy)]/60">{lastInbound?.body ?? "—"}</div>
            <div className="mt-3">Messages aujourd’hui: <span className="font-semibold text-[var(--brand-navy)]">{messagesToday ?? 0}</span></div>
            <div>Leads closés aujourd’hui: <span className="font-semibold text-[var(--brand-navy)]">{leadsClosed ?? 0}</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

