"use client";

import Link from "next/link";
import type React from "react";
import { ArrowRight, BadgeCheck, Bot, MessageCircle, Phone, Sparkles, Timer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserPlan } from "@/lib/data/use-user-plan";

export function HomeClient({ className }: { className: string }) {
  const u = useUserPlan();
  const primaryHref = u.isLoggedIn ? "/app" : "/signup";
  const primaryLabel = u.isLoggedIn ? "Aller au dashboard" : "Commencer gratuitement";

  // When logged in, we never show a "Se connecter" CTA.
  const secondaryHref = u.isLoggedIn ? "/app/chat" : "/login";
  const secondaryLabel = u.isLoggedIn ? "Utiliser l’IA" : "Se connecter";

  return (
    <div className={className}>
      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy)]/10 bg-white/70 px-3 py-1 text-xs text-[var(--brand-navy)]/80 shadow-sm">
                <Sparkles className="size-3.5 text-[var(--brand-gold)]" />
                Premium Africa Business • WhatsApp-first
              </div>

              <h1 className="[font-family:var(--font-home-poppins),var(--font-home-inter),var(--font-sans)] text-3xl font-bold leading-[1.08] tracking-tight text-[var(--brand-navy)] sm:text-5xl">
                Votre employé IA qui répond à vos clients et vend sur WhatsApp
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-[var(--brand-navy)]/75 sm:text-lg">
                Répondez plus vite, rassurez vos prospects et transformez plus de conversations en ventes.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg" className="h-12 px-6 text-base font-medium sm:h-11 sm:text-sm" disabled={u.loading}>
                  <Link href={primaryHref}>
                    {primaryLabel} <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-[var(--brand-navy)]/15 bg-white/70 text-[var(--brand-navy)] hover:bg-white sm:h-11 sm:text-sm"
                  disabled={u.loading}
                >
                  <Link href={secondaryHref}>{secondaryLabel}</Link>
                </Button>
              </div>

              {!u.isLoggedIn ? <p className="text-sm text-[var(--brand-navy)]/60">Aucune carte bancaire requise</p> : null}

              <div className="flex flex-wrap gap-3 pt-2 text-xs text-[var(--brand-navy)]/70">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-navy)]/10 bg-white/70 px-3 py-1 shadow-sm">
                  <BadgeCheck className="size-4 text-[var(--brand-green)]" />
                  Messages pro en 1 clic
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-navy)]/10 bg-white/70 px-3 py-1 shadow-sm">
                  <Timer className="size-4 text-[var(--brand-gold)]" />
                  Réponse en secondes
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-navy)]/10 bg-white/70 px-3 py-1 shadow-sm">
                  <TrendingUp className="size-4 text-[var(--brand-navy)]" />
                  Plus de ventes WhatsApp
                </span>
              </div>
            </div>

            <div className="lg:justify-self-end">
              <SmartphoneMock />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--brand-navy)]/10 bg-[hsl(var(--background))]">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-3">
            <Feature
              icon={Bot}
              title="Réponses IA premium"
              desc="Optimisées pour convertir, rassurer et closer."
              ctaLabel={u.isLoggedIn ? "Aller à l’IA" : "Voir la démo"}
              ctaHref={u.isLoggedIn ? "/app/chat" : "/pricing"}
              loading={u.loading}
            />
            <Feature
              icon={MessageCircle}
              title="Relances automatiques"
              desc="Recontactez au bon moment, sans effort."
              ctaLabel="Voir les tarifs"
              ctaHref="/pricing"
              loading={u.loading}
            />
            <Feature
              icon={Phone}
              title="WhatsApp-first"
              desc="Pensé pour les vendeurs et e-commerçants africains."
              ctaLabel={u.isLoggedIn ? "Dashboard" : "Créer un compte"}
              ctaHref={u.isLoggedIn ? "/app" : "/signup"}
              loading={u.loading}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
  ctaLabel,
  ctaHref,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  ctaLabel: string;
  ctaHref: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3 text-[var(--brand-navy)]">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))]">
          <Icon className="size-5 text-[var(--brand-green)]" />
        </span>
        <div className="text-base font-semibold">{title}</div>
      </div>
      <div className="mt-2 text-sm text-[var(--brand-navy)]/65">{desc}</div>
      <div className="mt-4">
        <Button asChild size="lg" variant="outline" className="w-full bg-white" disabled={loading}>
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

function SmartphoneMock() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="absolute -inset-6 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_25%_15%,rgba(22,163,74,0.25),transparent_55%),radial-gradient(circle_at_75%_85%,rgba(245,158,11,0.22),transparent_55%)] blur-2xl" />

      <div className="overflow-hidden rounded-[36px] border border-[var(--brand-navy)]/15 bg-[hsl(var(--background))] shadow-[0_22px_60px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-[var(--brand-navy)]/10 bg-white/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))]">
              <div className="absolute inset-0 [background:radial-gradient(circle_at_35%_25%,rgba(22,163,74,0.25),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(245,158,11,0.22),transparent_55%)]" />
              <span className="relative flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--brand-navy)]">CK</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-[var(--brand-navy)]">Cliente</div>
              <div className="text-xs text-[var(--brand-navy)]/60">En ligne</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-navy)]/10 bg-white px-2 py-1 text-[10px] font-medium text-[var(--brand-navy)]/70 shadow-sm">
            <MessageCircle className="size-3" />
            WhatsApp
          </div>
        </div>

        <div className="space-y-3 bg-[linear-gradient(to_bottom,rgba(248,250,252,1),rgba(248,250,252,0.94))] px-5 py-5">
          <Bubble from="customer">Bonjour, c’est combien le pack ? Vous livrez à Libreville ?</Bubble>
          <div className="flex items-center gap-2 px-1 text-[10px] font-medium text-[var(--brand-navy)]/50">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" />
            Optima Seller AI répond…
          </div>
          <Bubble from="ai">
            Bonjour 👋 Oui, livraison 24–48h à Libreville. Le pack est à 25 000 FCFA. Vous le voulez en{" "}
            <span className="font-semibold text-[var(--brand-navy)]">Standard</span> ou{" "}
            <span className="font-semibold text-[var(--brand-navy)]">Premium</span> ?
          </Bubble>
          <Bubble from="ai">
            Super. Je peux vous réserver le stock tout de suite. Paiement à la livraison ou Mobile Money ?
          </Bubble>
          <Bubble from="customer">Parfait, je prends Premium. Mobile Money.</Bubble>
          <div className="rounded-2xl border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.08)] px-4 py-3 text-xs text-[var(--brand-navy)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Vente confirmée</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--brand-navy)]/60">
                <BadgeCheck className="size-3 text-[var(--brand-green)]" />
                sécurisé
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--brand-navy)]/10 bg-white/70 px-5 py-4">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--brand-navy)]/10 bg-white px-4 py-3 text-xs text-[var(--brand-navy)]/50 shadow-sm">
            Écrire un message…
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-[var(--brand-navy)]/55">Démo visuelle — expérience optimisée mobile-first.</p>
    </div>
  );
}

function Bubble({ from, children }: { from: "customer" | "ai"; children: React.ReactNode }) {
  const isAI = from === "ai";
  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
      <div
        className={[
          "max-w-[86%] rounded-2xl px-4 py-3 text-sm shadow-sm",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          isAI ? "border border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]" : "border border-[var(--brand-green)]/15 bg-[rgba(22,163,74,0.10)] text-[var(--brand-navy)]",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

