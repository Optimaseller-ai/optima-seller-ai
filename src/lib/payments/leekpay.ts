import "server-only";

import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";

const checkoutRequestSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.string().min(1),
  description: z.string().min(1),
  return_url: z.string().url(),
  customer_email: z.string().email(),
});

const checkoutPayloadSchema = z
  .object({
    // LeekPay has had multiple response shapes in the wild; accept common variants.
    payment_url: z.string().url().optional(),
    paymentUrl: z.string().url().optional(),
    url: z.string().url().optional(),
    payment_id: z.union([z.string().min(1), z.number()]).optional(),
    paymentId: z.union([z.string().min(1), z.number()]).optional(),
  })
  .transform((v) => {
    const payment_url = v.payment_url ?? v.paymentUrl ?? v.url;
    if (!payment_url) {
      throw new z.ZodError([
        {
          code: "invalid_type",
          expected: "string",
          received: "undefined",
          path: ["payment_url"],
          message: "Invalid input: expected string, received undefined",
        },
      ]);
    }
    return { payment_url, payment_id: v.payment_id ?? v.paymentId };
  });

const checkoutResponseSchema = z
  .object({
    // Official docs: { success: true, data: { ... } }
    success: z.boolean().optional(),
    data: z.unknown().optional(),
  })
  .passthrough()
  .transform((v) => {
    const candidate = (v.data && typeof v.data === "object" ? v.data : v) as unknown;
    return checkoutPayloadSchema.parse(candidate);
  });

export type LeekPayCheckoutResponse = z.infer<typeof checkoutResponseSchema>;

export function getLeekPayKeys() {
  if (!env.LEEKPAY_SECRET_KEY) throw new Error("Missing env LEEKPAY_SECRET_KEY.");
  if (!env.LEEKPAY_PUBLIC_KEY) throw new Error("Missing env LEEKPAY_PUBLIC_KEY.");
  return { secretKey: env.LEEKPAY_SECRET_KEY, publicKey: env.LEEKPAY_PUBLIC_KEY };
}

export function isLeekPayTestMode(secretKey: string) {
  return /^sk_test_/i.test(secretKey) || /test/i.test(secretKey);
}

export async function createLeekPayCheckout(input: {
  amount: number;
  currency: "XOF";
  description: string;
  returnUrl: string;
  customerEmail: string;
}) {
  const { secretKey } = getLeekPayKeys();

  const payload = checkoutRequestSchema.parse({
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    return_url: input.returnUrl,
    customer_email: input.customerEmail,
  });

  const resp = await fetch("https://leekpay.fr/api/v1/checkout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg =
      typeof (json as any)?.message === "string"
        ? (json as any).message
        : typeof (json as any)?.error === "string"
          ? (json as any).error
          : typeof (json as any)?.data?.message === "string"
            ? (json as any).data.message
            : undefined;
    throw new Error(msg ?? `LeekPay checkout failed (HTTP ${resp.status}).`);
  }

  return checkoutResponseSchema.parse(json);
}

export function verifyLeekPaySignature(rawBody: string, signatureHeader: string | null) {
  const { publicKey } = getLeekPayKeys();
  if (!signatureHeader) return false;

  const expected = crypto.createHmac("sha256", publicKey).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}
