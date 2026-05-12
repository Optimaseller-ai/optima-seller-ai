import { NextResponse } from "next/server";
import { processDueAgentFollowups } from "@/lib/chat/process-agent-followups";

export const runtime = "nodejs";

function getCronSecret() {
  return (process.env.CRON_SECRET || "").trim();
}

export async function POST(req: Request) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 404 });

  const header = req.headers.get("x-cron-secret")?.trim() || "";
  if (header !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const out = await processDueAgentFollowups({ max: 40 });
  if (!out.ok) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, processed: out.processed, results: out.results }, { status: 200 });
}
