"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserPlan } from "@/lib/data/use-user-plan";

export function PricingHeroCtas() {
  const u = useUserPlan();

  if (u.loading) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="h-11 w-[160px] rounded-[var(--radius)] bg-[var(--brand-navy)]/5" />
        <div className="h-11 w-[190px] rounded-[var(--radius)] bg-[var(--brand-navy)]/5" />
      </div>
    );
  }

  if (u.isLoggedIn) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline" className="bg-white">
          <Link href="/app">Aller au dashboard</Link>
        </Button>
        <Button asChild className="shadow-sm">
          <Link href="/app/chat">
            Utiliser l&apos;IA <ArrowUpRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button asChild variant="outline" className="bg-white">
        <Link href="/login">Se connecter</Link>
      </Button>
      <Button asChild className="shadow-sm">
        <Link href="/signup">
          Créer un compte <ArrowUpRight className="ml-2 size-4" />
        </Link>
      </Button>
    </div>
  );
}

