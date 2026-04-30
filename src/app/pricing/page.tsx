import Link from "next/link";
import { Check, Sparkles, ArrowUpRight, HelpCircle } from "lucide-react";
import { UnifiedNavbar } from "@/components/nav/unified-navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PricingPrimaryCta, PricingTrialCta } from "@/app/pricing/pricing-ctas";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(56rem_38rem_at_20%_10%,rgba(22,163,74,0.12),transparent_60%),radial-gradient(52rem_36rem_at_90%_0%,rgba(245,158,11,0.12),transparent_55%),radial-gradient(48rem_36rem_at_70%_90%,rgba(15,23,42,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <UnifiedNavbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* HERO */}
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy)]/10 bg-white px-3 py-1 text-xs font-medium text-[var(--brand-navy)]/75 shadow-sm">
            <Sparkles className="size-3.5 text-[var(--brand-gold)]" />
            Tarifs simples • WhatsApp-first
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-4xl">
                Choisissez le plan qui fait grandir vos ventes
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--brand-navy)]/65 sm:text-base">
                Commencez gratuitement. Passez Pro quand vous êtes prêt.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="bg-white">
                <Link href="/app">Voir le dashboard</Link>
              </Button>
              <Button asChild className="shadow-sm">
                <Link href="/signup">
                  Créer un compte <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* PRICING CARDS */}
        <section className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-3">
          <PlanCard
            name="FREE"
            price="0"
            suffix="FCFA / mois"
            description="Pour démarrer et tester Optima."
            features={["10 générations / mois", "Outils IA complets", "Mini CRM pipeline"]}
            cta={
              <PricingPrimaryCta plan="free" />
            }
          />

          <PlanCard
            name="PRO"
            price="3000"
            suffix="FCFA / mois"
            description="Le meilleur plan pour vendre sérieusement."
            highlight
            badge="Le plus choisi"
            features={[
              "Quota élevé",
              "Historique complet",
              "Support prioritaire",
              "Réponses plus rapides",
            ]}
            cta={
              <div className="grid gap-2">
                <PricingPrimaryCta plan="pro" />
                <PricingTrialCta />
              </div>
            }
          />

          <PlanCard
            name="BUSINESS"
            price="5000"
            suffix="FCFA / mois"
            description="Pour volume + équipe + priorité."
            features={[
              "Très gros quota",
              "Multi équipe",
              "Support premium",
              "Priorité nouveautés",
            ]}
            cta={
              <PricingPrimaryCta plan="business" />
            }
          />
        </section>

        {/* FOUNDER OFFER */}
        <section className="mt-8 lg:mt-10">
          <Card className="relative overflow-hidden border-[var(--brand-gold)]/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(22,163,74,0.10),rgba(255,255,255,0.55))] shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
            <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(44rem_28rem_at_20%_10%,rgba(245,158,11,0.20),transparent_55%),radial-gradient(46rem_30rem_at_90%_80%,rgba(22,163,74,0.18),transparent_55%)]" />
            <CardHeader className="relative">
              <CardTitle className="text-[var(--brand-navy)]">Offre fondateur</CardTitle>
              <CardDescription className="text-[var(--brand-navy)]/70">
                Limitée aux 50 premiers utilisateurs
              </CardDescription>
            </CardHeader>
            <CardContent className="relative grid gap-4 p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
              <div className="text-sm leading-relaxed text-[var(--brand-navy)]/70">
                Accès fondateur à tarif réduit. Réservez votre place et démarrez avec un avantage durable.
              </div>
              <Button asChild size="lg" className="h-11">
                <Link href="/signup">Réserver ma place</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* TRUST */}
        <section className="mt-8 lg:mt-10">
          <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 text-[var(--brand-navy)] shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <div className="text-sm font-semibold">Rentabilisé dès 1 vente supplémentaire.</div>
            <div className="mt-1 text-sm text-[var(--brand-navy)]/65">
              Une meilleure réponse WhatsApp peut suffire à convertir un prospect hésitant.
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-8 space-y-3 lg:mt-10">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] sm:text-xl">FAQ</h2>
            <p className="text-sm text-[var(--brand-navy)]/65">
              Des réponses claires pour acheter sereinement.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FaqCard
              q="Puis-je annuler à tout moment ?"
              a="Oui. Vous gardez l’accès jusqu’à la fin de la période en cours."
            />
            <FaqCard
              q="L’essai gratuit dure vraiment 7 jours ?"
              a="Oui, 7 jours complets pour tester l’outil dans vos conversations WhatsApp."
            />
            <FaqCard
              q="Mobile Money arrive bientôt ?"
              a="Oui. Nous finalisons l’intégration pour faciliter le paiement local."
            />
            <FaqCard
              q="Puis-je changer de plan ?"
              a="Oui. Vous pouvez upgrader ou ajuster votre plan selon votre volume."
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function PlanCard({
  name,
  price,
  suffix,
  description,
  features,
  cta,
  highlight,
  badge,
}: {
  name: string;
  price: string;
  suffix: string;
  description: string;
  features: string[];
  cta: React.ReactNode;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <Card
      className={cn(
        "border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]",
        highlight
          ? "relative border-[var(--brand-green)]/22 shadow-[0_22px_60px_rgba(15,23,42,0.14)]"
          : undefined,
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-[var(--brand-navy)]">
          <span>{name}</span>
          {badge ? (
            <span className="inline-flex items-center rounded-full border border-[var(--brand-gold)]/35 bg-[rgba(245,158,11,0.14)] px-2.5 py-1 text-[11px] font-medium text-[var(--brand-navy)]">
              {badge}
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-3 sm:p-6">
        <div className="text-3xl font-semibold tracking-tight text-[var(--brand-navy)]">
          {price} <span className="text-base font-medium text-[var(--brand-navy)]/55">{suffix}</span>
        </div>

        <ul className="space-y-2 text-sm text-[var(--brand-navy)]/70">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 text-[var(--brand-green)]" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {cta}
      </CardContent>
    </Card>
  );
}

function FaqCard({ q, a }: { q: string; a: string }) {
  return (
    <Card className="border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-start gap-2 text-base text-[var(--brand-navy)]">
          <HelpCircle className="mt-0.5 size-4 text-[var(--brand-gold)]" />
          <span>{q}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-[var(--brand-navy)]/70">{a}</CardContent>
    </Card>
  );
}
