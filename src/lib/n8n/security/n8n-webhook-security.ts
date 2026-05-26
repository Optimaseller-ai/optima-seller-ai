import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function primarySecret(): string | null {
  const s = String(
    process.env.OPTIMA_N8N_SIGNING_SECRET ??
      process.env.N8N_WEBHOOK_SIGNING_SECRET ??
      process.env.N8N_WEBHOOK_SECRET ??
      "",
  ).trim();
  return s || null;
}

function rotationSecrets(): string[] {
  const raw = String(process.env.OPTIMA_N8N_SIGNING_SECRET_ROTATION ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function allSecrets(): string[] {
  const out: string[] = [];
  const primary = primarySecret();
  if (primary) out.push(primary);
  for (const s of rotationSecrets()) {
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export function signN8nPayload(rawBody: string, secret?: string): string {
  const sec = secret ?? primarySecret();
  if (!sec) return "";
  return createHmac("sha256", sec).update(rawBody).digest("hex");
}

export function buildOutboundSignatureHeaders(rawBody: string): Record<string, string> {
  const sig = signN8nPayload(rawBody);
  const headers: Record<string, string> = {
    "X-Optima-Timestamp": String(Date.now()),
  };
  if (sig) headers["X-Optima-Signature"] = `sha256=${sig}`;
  const webhookSecret = String(process.env.N8N_WEBHOOK_SECRET ?? "").trim();
  if (webhookSecret) headers["X-Optima-Webhook-Secret"] = webhookSecret;
  return headers;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a.replace(/^sha256=/i, ""), "hex");
    const bb = Buffer.from(b.replace(/^sha256=/i, ""), "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export type InboundWebhookValidation = {
  ok: boolean;
  reason?: string;
};

/**
 * Valide un callback n8n entrant : signature HMAC, timestamp, anti-replay.
 */
export function validateInboundN8nWebhook(args: {
  rawBody: string;
  signatureHeader?: string | null;
  timestampHeader?: string | null;
}): InboundWebhookValidation {
  const secrets = allSecrets();
  if (secrets.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "signing_secret_missing" };
    }
    return { ok: true };
  }

  const sig = String(args.signatureHeader ?? "").trim();
  if (!sig) return { ok: false, reason: "missing_signature" };

  const tsRaw = args.timestampHeader;
  if (tsRaw) {
    const ts = Number(tsRaw);
    if (!Number.isFinite(ts)) return { ok: false, reason: "invalid_timestamp" };
    if (Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      return { ok: false, reason: "timestamp_out_of_window" };
    }
  }

  const matched = secrets.some((sec) => {
    const expected = signN8nPayload(args.rawBody, sec);
    return safeEqualHex(sig, expected) || safeEqualHex(sig, `sha256=${expected}`);
  });

  if (!matched) return { ok: false, reason: "invalid_signature" };
  return { ok: true };
}
