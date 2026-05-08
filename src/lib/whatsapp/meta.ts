import "server-only";

import crypto from "node:crypto";
import { env } from "@/lib/env";

export type WhatsAppTextMessage = {
  to: string; // wa_id / phone
  text: string;
};

export function verifyMetaSignature(rawBody: string, signature256: string | null) {
  const secret = env.WHATSAPP_APP_SECRET;
  if (!secret) throw new Error("Missing env WHATSAPP_APP_SECRET.");
  if (!signature256) return false;
  // Expected: "sha256=<hex>"
  const [alg, sig] = signature256.split("=", 2);
  if (alg !== "sha256" || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function sendWhatsAppText(opts: { token: string; phoneNumberId: string; to: string; text: string }) {
  const resp = await fetch(`https://graph.facebook.com/v23.0/${opts.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: opts.to,
      type: "text",
      text: { body: opts.text },
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = typeof (json as any)?.error?.message === "string" ? (json as any).error.message : `HTTP ${resp.status}`;
    throw new Error(`WhatsApp send failed: ${msg}`);
  }
  return json as unknown;
}
