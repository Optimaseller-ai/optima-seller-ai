import Link from "next/link";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const userName = "Yuri";

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top: welcome + KPIs */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
              Bonjour {userName} <span aria-hidden>👋</span>
            </h1>
            <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
              Voici votre activité du jour.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="bg-white">
              <Link href="/pricing">Voir Pro</Link>
            </Button>
            <Button asChild className="shadow-sm">
              <Link href="/app/generator">
                Nouvelle génération <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            title="Générations restantes"
            value="8"
            delta="+2"
            deltaLabel="vs hier"
            icon={Sparkles}
          />
          <KpiCard
            title="Prospects suivis"
            value="14"
            delta="+4"
            deltaLabel="cette semaine"
            icon={Users}
          />
          <KpiCard
            title="Messages créés ce mois"
            value="32"
            delta="+12%"
            deltaLabel="vs dernier mois"
            icon={TrendingUp}
          />
        </div>
      </section>

      {/* Main actions */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--brand-navy)] sm:text-xl">
              Actions IA rapides
            </h2>
            <p className="text-sm text-[var(--brand-navy)]/65">
              Des réponses qui rassurent, relances qui convertissent, et scripts qui closent.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            tone="primary"
            title="Répondre client"
            description="Réponse immédiate + question de qualification."
            icon={MessageCircleMore}
            href="/app/generator?tab=reply"
          />
          <ActionCard
            tone="primary"
            title="Relancer prospect"
            description="Relance courte, persuasive, orientée prochaine action."
            icon={Clock}
            href="/app/generator?tab=followup"
          />
          <ActionCard
            tone="primary"
            title="Conclure vente"
            description="Traitez les objections et finalisez la commande proprement."
            icon={Zap}
            href="/app/generator?tab=closing"
          />
          <ActionCard
            tone="neutral"
            title="Gérer plainte"
            description="Message calme + solution + réassurance client."
            icon={ShieldCheck}
            href="/app/generator?tab=complaint"
          />
          <ActionCard
            tone="neutral"
            title="Message promo"
            description="Promo WhatsApp courte, claire, avec CTA."
            icon={Bot}
            href="/app/generator?tab=promo"
          />
        </div>
      </section>

      {/* History + usage + upgrade */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimelineCard />
        </div>
        <div className="space-y-4">
          <UsageCard used={2} total={10} />
          <UpgradeCard />
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  title,
  value,
  delta,
  deltaLabel,
  icon: Icon,
}: {
  title: string;
  value: string;
  delta: string;
  deltaLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(40rem_20rem_at_20%_10%,rgba(22,163,74,0.10),transparent_55%),radial-gradient(36rem_20rem_at_90%_60%,rgba(245,158,11,0.10),transparent_55%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[var(--brand-navy)]/60">
            {title}
          </div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">
            {value}
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-[var(--brand-navy)]/60">
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.08)] px-2 py-0.5 font-medium text-[var(--brand-navy)]">
              <TrendingUp className="size-3 text-[var(--brand-green)]" />
              {delta}
            </span>
            <span>{deltaLabel}</span>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--brand-navy)]/10 bg-white shadow-sm">
          <Icon className="size-5 text-[var(--brand-green)]" />
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  tone,
  title,
  description,
  icon: Icon,
  href,
}: {
  tone: "primary" | "neutral";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  const isPrimary = tone === "primary";
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius)] border bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(15,23,42,0.12)] motion-reduce:hover:translate-y-0",
        isPrimary ? "border-[var(--brand-green)]/18" : "border-[var(--brand-navy)]/10",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100",
          isPrimary
            ? "[background:radial-gradient(42rem_24rem_at_10%_0%,rgba(22,163,74,0.14),transparent_55%),radial-gradient(40rem_26rem_at_100%_60%,rgba(245,158,11,0.12),transparent_55%)]"
            : "[background:radial-gradient(42rem_24rem_at_10%_0%,rgba(15,23,42,0.06),transparent_55%),radial-gradient(40rem_26rem_at_100%_60%,rgba(245,158,11,0.10),transparent_55%)]",
        )}
      />
      <div className="relative flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--brand-navy)]/10 bg-white shadow-sm">
            <Icon className={cn("size-5", isPrimary ? "text-[var(--brand-green)]" : "text-[var(--brand-navy)]")} />
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-navy)]/10 bg-white px-2 py-1 text-[10px] font-medium text-[var(--brand-navy)]/70">
            IA
            <ArrowUpRight className="size-3" />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-base font-semibold text-[var(--brand-navy)]">
            {title}
          </div>
          <div className="text-sm leading-relaxed text-[var(--brand-navy)]/65">
            {description}
          </div>
        </div>

        <div className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-green)]">
          Ouvrir
          <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
        </div>
      </div>
    </Link>
  );
}

function TimelineCard() {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--brand-navy)]/10 p-5">
        <div className="space-y-1">
          <div className="text-base font-semibold text-[var(--brand-navy)]">
            Dernières générations
          </div>
          <div className="text-sm text-[var(--brand-navy)]/60">
            Date, type et aperçu — pour retrouver vite ce qui a converti.
          </div>
        </div>
        <Button asChild variant="outline" className="bg-white">
          <Link href="/app/generator">Voir tout</Link>
        </Button>
      </div>

      <div className="p-3 sm:p-5">
        <ol className="space-y-3">
          {RECENT.map((g) => (
            <li
              key={g.id}
              className="group relative rounded-[calc(var(--radius)-6px)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-4 transition-colors hover:bg-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-navy)]/10 bg-white px-2 py-0.5 text-xs font-medium text-[var(--brand-navy)]/80">
                      <Sparkles className="size-3 text-[var(--brand-gold)]" />
                      {g.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--brand-navy)]/55">
                      <Clock className="size-3.5" />
                      {g.date}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--brand-navy)]/75 line-clamp-2">
                    {g.preview}
                  </div>
                </div>
                <Link
                  href={g.href}
                  className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[var(--brand-green)] hover:underline"
                >
                  Ouvrir <ArrowUpRight className="size-3.5" />
                </Link>
              </div>

              <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-[calc(var(--radius)-6px)] bg-[var(--brand-green)]/0 transition-colors group-hover:bg-[var(--brand-green)]/40" />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function UsageCard({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="space-y-1">
        <div className="text-base font-semibold text-[var(--brand-navy)]">
          Quota mensuel utilisé
        </div>
        <div className="text-sm text-[var(--brand-navy)]/60">
          Gardez un œil sur votre volume pour optimiser vos ventes.
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-[var(--brand-navy)]/60">
          <span>
            {used} / {total}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[hsl(var(--background))]">
          <div
            className="h-full rounded-full bg-[var(--brand-green)] shadow-[0_0_0_1px_rgba(22,163,74,0.18)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-[var(--brand-navy)]/60">
          <CheckCircle2 className="size-4 text-[var(--brand-green)]" />
          Vos données restent privées. Branchez Supabase pour l’historique réel.
        </div>
      </div>
    </div>
  );
}

function UpgradeCard() {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--brand-gold)]/30 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(22,163,74,0.10),rgba(255,255,255,0.55))] p-5 shadow-[0_14px_40px_rgba(15,23,42,0.10)]">
      <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(40rem_20rem_at_20%_10%,rgba(245,158,11,0.20),transparent_55%),radial-gradient(44rem_24rem_at_90%_80%,rgba(22,163,74,0.18),transparent_55%)]" />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--brand-gold)]/30 bg-white/70 shadow-sm">
            <Sparkles className="size-5 text-[var(--brand-gold)]" />
          </div>
          <span className="inline-flex items-center rounded-full bg-[var(--brand-navy)] px-2.5 py-1 text-[10px] font-medium text-white shadow-sm">
            Pro
          </span>
        </div>

        <div>
          <div className="text-base font-semibold text-[var(--brand-navy)]">
            Passez Pro
          </div>
          <div className="mt-1 text-sm leading-relaxed text-[var(--brand-navy)]/70">
            Passez Pro pour plus de générations, historique illimité et support prioritaire.
          </div>
        </div>

        <div className="grid gap-2 text-xs text-[var(--brand-navy)]/70">
          <div className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--brand-green)]" />
            Plus de générations / mois
          </div>
          <div className="inline-flex items-center gap-2">
            <Clock className="size-4 text-[var(--brand-green)]" />
            Historique illimité
          </div>
          <div className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-[var(--brand-green)]" />
            Support prioritaire
          </div>
        </div>

        <div className="pt-1">
          <Button asChild variant="gold" size="lg" className="w-full">
            <Link href="/pricing">
              Upgrade Pro <ArrowUpRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

const RECENT = [
  {
    id: "1",
    type: "Réponse client",
    date: "Aujourd’hui • 09:14",
    preview:
      "Bonjour 👋 Oui c’est disponible. Le prix est 18 000 FCFA et livraison 24–48h. Vous le souhaitez en S, M ou L ?",
    href: "/app/generator?tab=reply",
  },
  {
    id: "2",
    type: "Relance prospect",
    date: "Hier • 18:40",
    preview:
      "Bonjour ! Petite relance 😊 Vous préférez livraison aujourd’hui ou demain ? Je peux vous réserver le stock.",
    href: "/app/generator?tab=followup",
  },
  {
    id: "3",
    type: "Closing",
    date: "Il y a 3 jours",
    preview:
      "Je comprends. Pour vous rassurer, paiement à la livraison possible. On valide la commande ?",
    href: "/app/generator?tab=closing",
  },
] as const;
