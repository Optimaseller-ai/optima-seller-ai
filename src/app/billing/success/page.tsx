"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription, isSubscriptionActive } from "@/lib/data/use-subscription";

export default function BillingSuccessPage() {
  const sub = useSubscription();
  const isPro = isSubscriptionActive(sub.subscription) && sub.subscription?.plan === "pro";

  // Soft-poll for a short time to allow webhook -> DB -> realtime to land.
  React.useEffect(() => {
    let cancelled = false;
    let tries = 0;
    async function tick() {
      if (cancelled) return;
      tries += 1;
      await sub.refresh();
      if (tries < 12) setTimeout(tick, 1500);
    }
    setTimeout(tick, 700);
    return () => {
      cancelled = true;
    };
  }, [sub]);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[hsl(var(--background))]">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-6 shadow-[0_22px_60px_rgba(15,23,42,0.12)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.14)] px-3 py-1 text-xs font-medium text-[var(--brand-navy)]">
                <Crown className="size-3.5 text-[var(--brand-gold)]" />
                Paiement reçu
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">Activation en cours…</h1>
              <p className="mt-1 text-sm text-[var(--brand-navy)]/65">
                Nous confirmons votre abonnement Pro et mettons à jour votre quota.
              </p>
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-xs text-[var(--brand-navy)]/55">
              <Loader2 className="size-4 animate-spin" />
              Vérification…
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" className="w-full" disabled={!isPro}>
              <Link href="/app">
                {isPro ? "Aller au dashboard" : "En attente…"} <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full bg-white">
              <Link href="/pricing">Voir les tarifs</Link>
            </Button>
          </div>

          {!sub.loading && !isPro ? (
            <div className="mt-4 rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-3 text-xs text-[var(--brand-navy)]/65">
              Si l’activation prend plus de 30 secondes, rafraîchissez la page. Sinon contactez le support depuis votre profil.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

