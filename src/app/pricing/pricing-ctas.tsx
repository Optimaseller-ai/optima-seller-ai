"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import { DateTime } from "luxon";

type Plan = "free" | "pro" | "business";
type UserPlan = "free" | "pro";

export function PricingPrimaryCta({ plan }: { plan: Plan }) {
  const { toast } = useToast();
  const [loaded, setLoaded] = React.useState(false);
  const [isAuthed, setIsAuthed] = React.useState(false);
  const [userPlan, setUserPlan] = React.useState<UserPlan>("free");

  React.useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (canceled) return;
        setIsAuthed(Boolean(data.user));

        if (!data.user) {
          setUserPlan("free");
          return;
        }

        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (canceled) return;

        if (sub?.plan === "pro") {
          setUserPlan("pro");
        } else {
          setUserPlan("free");
        }
      } catch {
        if (canceled) return;
        setIsAuthed(false);
        setUserPlan("free");
      } finally {
        if (!canceled) setLoaded(true);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, []);

  if (!loaded) return <div className="h-11 w-full rounded-[var(--radius)] bg-[var(--brand-navy)]/5" />;

  if (!isAuthed) {
    return (
      <Button asChild size="lg" className="w-full">
        <Link href="/signup">Créer un compte</Link>
      </Button>
    );
  }

  if (plan === "free") {
    return (
      <Button asChild size="lg" variant="outline" className="w-full bg-white">
        <Link href="/app">Aller au dashboard</Link>
      </Button>
    );
  }

  if (plan === "pro") {
    const active = userPlan === "pro";
    return (
      <Button
        asChild={!active}
        size="lg"
        className={cn("w-full", active ? "pointer-events-none opacity-70" : undefined)}
        onClick={() => {
          if (active) return;
          toast({ title: "Optima Pro", description: "Disponible bientôt." });
        }}
      >
        {active ? <span>Plan actif</span> : <span>Disponible bientôt</span>}
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
  const [loaded, setLoaded] = React.useState(false);
  const [isAuthed, setIsAuthed] = React.useState(false);

  React.useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (canceled) return;
        setIsAuthed(Boolean(data.user));
      } catch {
        if (canceled) return;
        setIsAuthed(false);
      } finally {
        if (!canceled) setLoaded(true);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, []);

  if (!loaded || isAuthed) return null;

  return (
    <Button asChild size="lg" variant="outline" className="w-full bg-white">
      <Link href="/signup">Essayer d&apos;abord</Link>
    </Button>
  );
}
