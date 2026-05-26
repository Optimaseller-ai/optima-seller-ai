import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createLeekPayCheckout } from "@/lib/payments/leekpay";

const bodySchema = z.object({
  plan: z.literal("pro"),
});

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr) throw authErr;
    if (!auth.user) return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });

    const body = bodySchema.parse(await req.json().catch(() => ({})));
    void body;

    const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const checkout = await createLeekPayCheckout({
      amount: 3000,
      currency: "XOF",
      description: "Abonnement Optima Pro",
      returnUrl: `${siteUrl}/billing/success`,
      customerEmail: auth.user.email ?? "",
    });

    // Store a pending upgrade marker (best-effort).
    try {
      await supabase
        .from("subscriptions")
        .update({
          subscription_status: "pending",
          payment_provider: "leekpay",
          payment_reference: checkout.payment_id ? String(checkout.payment_id) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", auth.user.id);
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, paymentUrl: checkout.payment_url });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Checkout failed.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

