import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/app/conversations");

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("user_id", data.user.id).maybeSingle();
  if ((sub?.plan ?? "free") !== "pro") redirect("/pricing");

  type ConversationRow = {
    id: string;
    agent_id: string;
    session_id: string;
    status: string;
    relance_count: number;
    last_message_at: string | null;
    last_user_message_at: string | null;
    last_ai_message_at: string | null;
    created_at: string;
    updated_at: string;
  };

  const { data: rows } = await supabase
    .from("conversations")
    .select("id,agent_id,session_id,status,relance_count,last_message_at,last_user_message_at,last_ai_message_at,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100)
    .returns<ConversationRow[]>();

  const items = rows ?? [];
  const activeCount = items.filter((c) => c.status !== "closed_won" && c.status !== "closed_lost").length;
  const relancedCount = items.filter((c) => (c.relance_count ?? 0) > 0 && c.status !== "closed_won" && c.status !== "closed_lost").length;
  const repliedAfterRelance = items.filter((c) => {
    if ((c.relance_count ?? 0) <= 0) return false;
    if (!c.last_user_message_at || !c.last_ai_message_at) return false;
    return new Date(c.last_user_message_at).getTime() > new Date(c.last_ai_message_at).getTime();
  }).length;
  const responseRate = relancedCount ? Math.round((repliedAfterRelance / relancedCount) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">Conversations</h1>
        <p className="mt-1 text-sm text-[var(--brand-navy)]/65">Suivi simple des conversations + relances.</p>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Chat public (IA)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-4 py-3">
              <div className="text-xs text-[var(--brand-navy)]/60">Conversations actives</div>
              <div className="mt-1 text-lg font-semibold text-[var(--brand-navy)]">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-4 py-3">
              <div className="text-xs text-[var(--brand-navy)]/60">Conversations relancées</div>
              <div className="mt-1 text-lg font-semibold text-[var(--brand-navy)]">{relancedCount}</div>
            </div>
            <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] px-4 py-3">
              <div className="text-xs text-[var(--brand-navy)]/60">Taux de réponse (approx.)</div>
              <div className="mt-1 text-lg font-semibold text-[var(--brand-navy)]">{responseRate}%</div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-sm text-[var(--brand-navy)]/60">Aucune conversation.</div>
          ) : (
            <ul className="divide-y divide-[var(--brand-navy)]/10 rounded-2xl border border-[var(--brand-navy)]/10">
              {items.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--brand-navy)]">
                      Session {String(c.session_id).slice(0, 10)}...
                    </div>
                    <div className="text-xs text-[var(--brand-navy)]/60">
                      {c.updated_at ? new Date(c.updated_at).toLocaleString("fr-FR") : "--"} • {c.status} • relances:{" "}
                      {c.relance_count ?? 0}/3
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

