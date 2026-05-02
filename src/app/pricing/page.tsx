import Link from "next/link";
import { Check, Sparkles, ArrowUpRight, HelpCircle } from "lucide-react";
import { UnifiedNavbarServer } from "@/components/nav/unified-navbar-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PricingPrimaryCta, PricingTrialCta } from "@/app/pricing/pricing-ctas";
import { PricingHeroCtas } from "@/app/pricing/pricing-hero-ctas";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(56rem_38rem_at_20%_10%,rgba(22,163,74,0.12),transparent_60%),radial-gradient(52rem_36rem_at_90%_0%,rgba(245,158,11,0.12),transparent_55%),radial-gradient(48rem_36rem_at_70%_90%,rgba(15,23,42,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <UnifiedNavbarServer />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
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
            <PricingHeroCtas />
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-3">
          <PlanCard
            name="FREE"
            price="0"
            suffix="FCFA / mois"
            description="Pour démarrer et tester Optima."
            features={["100 générations / mois", "Outils IA complets", "Mini CRM pipeline"]}
            cta={<PricingPrimaryCta plan="free" />}
          />

          <PlanCard
            name="Optima Pro"
            price="3000"
            suffix="FCFA / mois"
            description="Moins de 100 FCFA par jour"
            highlight
            badge="Le plus rentable"
            features={[
              "Quota élevé IA",
              "Réponses premium closing",
              "Relance prospects intelligente",
              "Historique complet",
              "Mémoire business avancée",
              "Priorité vitesse IA",
              "Support prioritaire",
              "Accès nouveautés",
            ]}
            extra={
              <div className="space-y-3">
                <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[rgba(15,23,42,0.02)] p-3 text-sm text-[var(--brand-navy)]/70">
                  <span className="font-semibold text-[var(--brand-navy)]">1 vente gagnée peut rembourser l’abonnement</span>
                </div>
                <div className="rounded-[var(--radius)] border border-[var(--brand-gold)]/25 bg-[rgba(245,158,11,0.10)] p-3 text-sm text-[var(--brand-navy)]/80">
                  Tarif fondateur limité aux 50 premiers utilisateurs
                </div>
                <div className="text-xs text-[var(--brand-navy)]/60">Annulable à tout moment</div>
              </div>
            }
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
            badge="Bientôt"
            features={[
              "Auto replies WhatsApp",
              "CRM + pipeline",
              "Relance prospects automatique",
              "Tagging leads + segments",
              "Horaires business + takeover",
            ]}
            cta={
              <Button asChild size="lg" variant="outline" className="w-full bg-white">
                <Link href="/app/profile">Contacter l’équipe</Link>
              </Button>
            }
          />

          <Card className="lg:col-span-3 border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <CardTitle className="text-[var(--brand-navy)]">Accès fondateur</CardTitle>
              <CardDescription className="text-[var(--brand-navy)]/70">Limitée aux 50 premiers utilisateurs</CardDescription>
            </CardHeader>
            <CardContent className="relative grid gap-4 p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
              <div className="text-sm leading-relaxed text-[var(--brand-navy)]/70">
                Accès fondateur à tarif réduit. Réservez votre place et démarrez avec un avantage durable.
              </div>
              <Button asChild size="lg" className="h-11">
                <Link href="/signup">
                  Réserver ma place <ArrowUpRight className="ml-2 size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="mt-8 lg:mt-10">
          <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 text-[var(--brand-navy)] shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <div className="text-sm font-semibold">Rentabilisé dès 1 vente supplémentaire.</div>
            <div className="mt-1 text-sm text-[var(--brand-navy)]/65">
              Une meilleure réponse WhatsApp peut suffire à convertir un prospect hésitant.
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-3 lg:mt-10">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] sm:text-xl">FAQ</h2>
            <p className="text-sm text-[var(--brand-navy)]/65">Des réponses claires pour acheter sereinement.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <FaqCard q="Puis-je annuler à tout moment ?" a="Oui. Vous gardez l’accès jusqu’à la fin de la période en cours." />
            <FaqCard q="L’essai gratuit dure vraiment 7 jours ?" a="Oui, 7 jours complets pour tester l’outil dans vos conversations WhatsApp." />
            <FaqCard q="Mobile Money arrive bientôt ?" a="Oui, c'est en préparation. Le paiement intégré arrive bientôt." />
            <FaqCard q="Puis-je changer de plan ?" a="Oui. Vous pouvez upgrader ou ajuster votre plan selon votre volume." />
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
  extra,
  highlight,
  badge,
}: {
  name: string;
  price: string;
  suffix: string;
  description: string;
  features: string[];
  cta: React.ReactNode;
  extra?: React.ReactNode;
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <Card
      className={cn(
        "border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]",
        highlight ? "relative border-[var(--brand-green)]/22 shadow-[0_22px_60px_rgba(15,23,42,0.14)]" : undefined,
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

        {extra ? extra : null}

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
