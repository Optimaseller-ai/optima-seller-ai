import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConversationThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=/app/conversations/${id}`);

  const { data: thread } = await supabase
    .from("customer_threads")
    .select("id,customer_wa_id,customer_name,status")
    .eq("id", id)
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!thread) redirect("/app/conversations");

  const { data: messages } = await supabase
    .from("messages")
    .select("id,direction,body,created_at")
    .eq("thread_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">
          {thread.customer_name || thread.customer_wa_id}
        </h1>
        <p className="mt-1 text-sm text-[var(--brand-navy)]/65">Statut: {thread.status}</p>
      </div>

      <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <CardTitle className="text-[var(--brand-navy)]">Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(messages ?? []).length === 0 ? (
            <div className="text-sm text-[var(--brand-navy)]/60">Aucun message.</div>
          ) : (
            <ol className="space-y-2">
              {(messages ?? []).map((m: any) => (
                <li
                  key={m.id}
                  className={[
                    "max-w-[92%] rounded-2xl border px-4 py-3 text-sm shadow-sm",
                    m.direction === "out"
                      ? "ml-auto border-[var(--brand-green)]/18 bg-[rgba(22,163,74,0.08)] text-[var(--brand-navy)]"
                      : "mr-auto border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]",
                  ].join(" ")}
                >
                  <div className="whitespace-pre-wrap">{String(m.body ?? "")}</div>
                  <div className="mt-1 text-[10px] text-[var(--brand-navy)]/55">
                    {m.created_at ? new Date(m.created_at).toLocaleString("fr-FR") : "—"}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

