import { NextResponse } from "next/server";
import { sweepAwaitingHumanSoftFallback } from "@/lib/automation/action-queue";

export const runtime = "nodejs";

function getCronSecret() {
  return (process.env.CRON_SECRET || "").trim();
}

/** Déclenche l’accusé réception soft pour jobs `awaiting_human` trop anciennes. */
export async function POST(req: Request) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ error: "cron_disabled" }, { status: 404 });

  const header = req.headers.get("x-cron-secret")?.trim() || "";
  if (header !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const minutesRaw = req.headers.get("x-soft-fallback-minutes") ?? "20";
  const minutes = Math.min(120, Math.max(5, Number(minutesRaw) || 20));
  const maxAgeMs = minutes * 60 * 1000;

  const swept = await sweepAwaitingHumanSoftFallback({ maxAgeMs });

  return NextResponse.json({ ok: true, softFallbackSwept: swept, maxAgeMinutes: minutes }, { status: 200 });
}
