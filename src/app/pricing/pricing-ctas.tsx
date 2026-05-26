"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { useUserPlan } from "@/lib/data/use-user-plan";
import { UpgradeButton } from "@/components/premium/UpgradeButton";

type Plan = "free" | "pro" | "business";

export function PricingPrimaryCta({ plan }: { plan: Plan }) {
  const { toast } = useToast();
  const u = useUserPlan();

  if (u.loading) return <div className="h-11 w-full rounded-[var(--radius)] bg-[var(--brand-navy)]/5" />;

  if (!u.isLoggedIn) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href="/signup">Créer un compte</Link>
      </Button>
    );
  }

  if (plan === "free") {
    if (u.isPro) {
      return (
        <Button size="lg" variant="outline" className="w-full pointer-events-none bg-white opacity-70">
          Inclus dans votre abonnement
        </Button>
      );
    }

    return (
      <Button size="lg" variant="outline" className="w-full pointer-events-none bg-white opacity-70">
        Plan actuel
      </Button>
    );
  }

  if (plan === "pro") {
    const active = u.isPro;
    if (!active) {
      return <UpgradeButton className="w-full justify-center" label="Passer au plan Pro" />;
    }
    return (
      <Button
        asChild={!active}
        size="lg"
        className={cn("w-full", active ? "pointer-events-none opacity-70" : undefined)}
        onClick={() => {
          if (active) return;
          if (u.isFree) toast({ title: "Optima Pro", description: "Redirection…" });
        }}
      >
        <span>Plan Pro actif</span>
      </Button>
    );
  }

  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="w-full bg-white"
      onClick={() => {
        toast({ title: "Business", description: "Contactez-nous depuis votre profil." });
      }}
    >
      <Link href="/app/profile">Contacter l’équipe</Link>
    </Button>
  );
}

export function PricingTrialCta() {
  const u = useUserPlan();
  if (u.loading || u.isLoggedIn) return null;

  return (
    <Button asChild size="lg" variant="outline" className="w-full bg-white">
      <Link href="/signup">Essayer d&apos;abord</Link>
    </Button>
  );
}
