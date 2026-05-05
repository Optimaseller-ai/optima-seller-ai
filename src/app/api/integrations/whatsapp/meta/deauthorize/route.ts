import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

const bodySchema = z.object({
  signed_request: z.string().min(1),
});

function parseSignedRequest(signedRequest: string, appSecret: string) {
  const [sigB64, payloadB64] = signedRequest.split(".", 2);
  if (!sigB64 || !payloadB64) throw new Error("Invalid signed_request format.");

  const sig = Buffer.from(sigB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const payloadJson = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const payload = JSON.parse(payloadJson) as any;

  const expected = crypto.createHmac("sha256", appSecret).update(payloadB64, "utf8").digest();
  if (expected.length !== sig.length || !crypto.timingSafeEqual(expected, sig)) throw new Error("Invalid signed_request signature.");
  return payload;
}

export async function POST(req: Request) {
  // Embedded Signup only: we don't have a reliable mapping from Meta user_id -> app user_id.
  // We still return 200 so Meta doesn't retry forever.
  try {
    if (!env.META_APP_SECRET) {
      console.error("Meta deauthorize: missing META_APP_SECRET");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      console.error("Meta deauthorize: invalid body", parsed.error);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const payload = parseSignedRequest(parsed.data.signed_request, env.META_APP_SECRET);
    console.log("Meta deauthorize received", {
      hasUserId: typeof payload?.user_id === "string",
      issuedAt: payload?.issued_at ?? null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("Meta deauthorize fatal error:", e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

