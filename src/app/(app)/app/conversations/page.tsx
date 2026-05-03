import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/conversations");

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") redirect("/pricing");

  const { data: threads } = await supabase
    .from("customer_threads")
    .select("id,customer_wa_id,customer_name,last_message_at,status,updated_at")
    .eq("user_id", data.user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">Conversations</h1>
        <p className="mt-1 text-sm text-[var(--brand-navy)]/65">Suivi des conversations WhatsApp (MVP).</p>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(threads ?? []).length === 0 ? (
            <div className="text-sm text-[var(--brand-navy)]/60">Aucune conversation.</div>
          ) : (
            <ul className="divide-y divide-[var(--brand-navy)]/10 rounded-2xl border border-[var(--brand-navy)]/10">
              {(threads ?? []).map((t: any) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--brand-navy)]">
                      {t.customer_name || t.customer_wa_id}
                    </div>
                    <div className="text-xs text-[var(--brand-navy)]/60">
                      {t.last_message_at ? new Date(t.last_message_at).toLocaleString("fr-FR") : "—"} • {t.status}
                    </div>
                  </div>
                  <Link className="text-sm text-[var(--brand-green)] hover:underline" href={`/app/conversations/${t.id}`}>
                    Ouvrir
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

