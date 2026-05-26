import { NextResponse } from "next/server";

import { ingestN8nWebhookCallback } from "@/lib/n8n/n8n-execution-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const rawBody = await req.text();
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const signatureHeader = req.headers.get("x-optima-signature") ?? req.headers.get("X-Optima-Signature");
  const timestampHeader = req.headers.get("x-optima-timestamp") ?? req.headers.get("X-Optima-Timestamp");

  const result = await ingestN8nWebhookCallback({
    body,
    rawBody,
    signatureHeader,
    timestampHeader,
  });

  if (!result.ok && result.reason === "invalid_signature") {
    return NextResponse.json(result, { status: 401 });
  }
  if (!result.ok && result.reason === "signing_secret_missing" && process.env.NODE_ENV === "production") {
    return NextResponse.json(result, { status: 503 });
  }
  if (!result.ok && result.reason === "invalid_payload") {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
