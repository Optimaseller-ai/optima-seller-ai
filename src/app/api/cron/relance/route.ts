import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRelanceForConversation } from "@/lib/chat/run-relance";

export const runtime = "nodejs";

function getCronSecret() {
  // keep it optional in dev; when unset, endpoint is disabled
  return (process.env.CRON_SECRET || "").trim();
}

export async function POST(req: Request) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 404 });

  const header = req.headers.get("x-cron-secret")?.trim() || "";
  if (header !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await admin
    .from("conversations")
    .select("id,status,relance_count,next_relance_at")
    .lte("next_relance_at", nowIso)
    .not("next_relance_at", "is", null)
    .in("status", ["active", "interested", "pending"]);
  if (error) return NextResponse.json({ error: "query_failed" }, { status: 500 });

  const items = Array.isArray(due) ? due.slice(0, 50) : [];
  let processed = 0;
  const results: Array<{ id: string; ok: boolean; reason?: string }> = [];

  for (const c of items) {
    const out = await runRelanceForConversation({ conversationId: String((c as any).id), force: false });
    processed += 1;
    results.push(out.ok ? { id: out.conversationId, ok: true } : { id: String((c as any).id), ok: false, reason: out.reason });
  }

  return NextResponse.json({ ok: true, processed, results }, { status: 200 });
}
