import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyLeekPaySignature } from "@/lib/payments/leekpay";
import { createAdminClient } from "@/lib/supabase/admin";

const webhookSchema = z.object({
  event: z.string().optional(),
  type: z.string().optional(),
  payment: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      status: z.string().optional(),
      customer_email: z.string().email().optional(),
      customerEmail: z.string().email().optional(),
    })
    .optional(),
  transaction: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      status: z.string().optional(),
      customer_email: z.string().email().optional(),
      customerEmail: z.string().email().optional(),
    })
    .optional(),
  customer_email: z.string().email().optional(),
});

function normalizeEmail(payload: z.infer<typeof webhookSchema>) {
  return (
    payload.customer_email ??
    payload.payment?.customer_email ??
    payload.payment?.customerEmail ??
    payload.transaction?.customer_email ??
    payload.transaction?.customerEmail ??
    null
  );
}

function normalizePaymentId(payload: z.infer<typeof webhookSchema>) {
  const id = payload.payment?.id ?? payload.transaction?.id ?? null;
  return id ? String(id) : null;
}

function isSuccess(payload: z.infer<typeof webhookSchema>) {
  const event = (payload.event ?? payload.type ?? "").toLowerCase();
  const txStatus = (payload.transaction?.status ?? payload.payment?.status ?? "").toLowerCase();
  return event.includes("payment.success") || event.includes("payment_success") || txStatus === "completed" || txStatus === "success";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-leekpay-signature");
  if (!verifyLeekPaySignature(rawBody, signature)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const payload = webhookSchema.parse(parsed);
  if (!isSuccess(payload)) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const email = normalizeEmail(payload);
  if (!email) return NextResponse.json({ success: false, error: "MISSING_EMAIL" }, { status: 400 });

  const paymentId = normalizePaymentId(payload);

  const admin = createAdminClient();

  const { data: userRow, error: userErr } = await admin
    .from("profiles")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (userErr) return NextResponse.json({ success: false, error: userErr.message }, { status: 500 });
  if (!userRow?.id) return NextResponse.json({ success: true, ignored: true });

  const now = new Date().toISOString();
  const { error: upsertErr } = await admin.from("subscriptions").upsert(
    {
      user_id: userRow.id,
      plan: "pro",
      quota_limit: 2000,
      expires_at: null,
      subscription_status: "active",
      pro_since: now,
      payment_provider: "leekpay",
      payment_reference: paymentId,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (upsertErr) return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
