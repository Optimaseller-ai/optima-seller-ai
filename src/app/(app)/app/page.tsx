"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowUpRight, Bot, CheckCircle2, Crown, MessageSquareReply, ShieldCheck, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/data/use-profile";
import { useQuota } from "@/lib/data/use-quota";
import { useRecentGenerations } from "@/lib/data/use-generations";
import { createOptionalSupabaseClient } from "@/lib/data/supabase";
import { MemoryBanner } from "@/components/app/memory-banner";

export default function DashboardPage() {
  const profile = useProfile();
  const quota = useQuota();
  const recent = useRecentGenerations(6);
  const [memberSince, setMemberSince] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createOptionalSupabaseClient();
        if (!supabase) return;
        const { data } = await supabase.auth.getUser();
        if (!data.user || cancelled) return;
        setMemberSince(data.user.created_at ?? null);
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const userLabel =
    profile.profile?.full_name?.trim() ||
    profile.profile?.business_name?.trim() ||
    "là";

  const planLabel = quota.plan === "pro" ? "Pro" : "Free";

  return (
    <div className="space-y-6 sm:space-y-8">
      <MemoryBanner />
      {/* Top: welcome + KPIs */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
              Bonjour {userLabel}
            </h1>
            <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
              Votre plateforme est connectée à Supabase : données, quota et historique.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="bg-white">
              <Link href="/pricing">Voir Pro</Link>
            </Button>
            <Button asChild className="shadow-sm" disabled={quota.exhausted}>
              <Link href="/app/generator">
                Nouvelle génération <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard title="Générations restantes" value={quota.loading ? "…" : String(quota.remaining)} delta={quota.loading ? "…" : `${quota.remaining}/${quota.limit}`} deltaLabel="ce mois" icon={Sparkles} />
          <KpiCard title="Plan actuel" value={planLabel} delta={quota.expires_at ? "Expire" : "Actif"} deltaLabel={quota.expires_at ? new Date(quota.expires_at).toLocaleDateString("fr-FR") : "—"} icon={Crown} />
          <KpiCard title="Générations utilisées" value={quota.loading ? "…" : String(quota.used)} delta="Sync" deltaLabel="temps réel" icon={TrendingUp} />
        </div>
      </section>

      {/* Main actions */}
      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)] sm:text-xl">Actions IA rapides</h2>
          <p className="text-sm text-[var(--brand-navy)]/65">
            Réponses, relances et scripts — adaptés à votre business automatiquement.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ActionCard tone="primary" title="Répondre client" description="Réponse immédiate + question de qualification." icon={Users} href="/app/generator?tab=reply" />
          <ActionCard tone="primary" title="Auto Reply (semi-auto)" description="Collez le message du client. Réponse instantanée." icon={MessageSquareReply} href="/app/auto-reply" />
          <ActionCard tone="primary" title="Relancer prospect" description="Relance courte, persuasive, orientée action." icon={Zap} href="/app/generator?tab=followup" />
          <ActionCard tone="primary" title="Conclure vente" description="Traitez les objections et finalisez proprement." icon={Sparkles} href="/app/generator?tab=closing" />
          <ActionCard tone="neutral" title="Gérer plainte" description="Message calme + solution + réassurance." icon={ShieldCheck} href="/app/generator?tab=complaint" />
          <ActionCard tone="neutral" title="Message promo" description="Promo WhatsApp courte, claire, avec CTA." icon={Bot} href="/app/generator?tab=promo" />
        </div>
      </section>

      {/* History + usage + upgrade */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimelineCard items={recent.items} loading={recent.loading} />
        </div>
        <div className="space-y-4">
          <UsageCard used={quota.used} total={quota.limit} />
          <UpgradeCard />
          <MemberCard businessName={profile.profile?.business_name ?? null} memberSince={memberSince} />
        </div>
      </section>
    </div>
  );
}

function MemberCard({ businessName, memberSince }: { businessName: string | null; memberSince: string | null }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="text-sm font-semibold text-[var(--brand-navy)]">Infos</div>
      <div className="mt-3 space-y-2 text-sm text-[var(--brand-navy)]/70">
        <div className="flex items-center justify-between gap-3">
          <span>Business</span>
          <span className="font-medium text-[var(--brand-navy)]">{businessName?.trim() || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Membre depuis</span>
          <span className="font-medium text-[var(--brand-navy)]">
            {memberSince ? new Date(memberSince).toLocaleDateString("fr-FR") : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function UsageCard({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="space-y-1">
        <div className="text-base font-semibold text-[var(--brand-navy)]">Quota mensuel</div>
        <div className="text-sm text-[var(--brand-navy)]/60">Suivi en temps réel.</div>
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
          {total > used ? "Quota disponible." : "Quota atteint pour ce mois."}
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
          <div className="text-base font-semibold text-[var(--brand-navy)]">Upgrade Pro</div>
          <div className="mt-1 text-sm leading-relaxed text-[var(--brand-navy)]/70">
            Paiement intégré : disponible bientôt. En attendant, un admin peut vous activer manuellement dans Supabase.
          </div>
        </div>

        <div className="pt-1">
          <Button size="lg" className="w-full pointer-events-none opacity-70">
            Disponible bientôt <ArrowUpRight className="ml-2 size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ items, loading }: { items: any[]; loading: boolean }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-[var(--brand-navy)]">Dernières générations</div>
          <div className="mt-1 text-sm text-[var(--brand-navy)]/60">Historique réel (Supabase).</div>
        </div>
        <Button asChild variant="outline" className="bg-white">
          <Link href="/app/generator">Générer</Link>
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-sm text-[var(--brand-navy)]/60">Chargement…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-[var(--brand-navy)]/60">Aucune génération pour le moment.</div>
        ) : (
          <ol className="space-y-2">
            {items.map((g: any) => (
              <li key={g.id} className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-[var(--brand-navy)]/70">{String(g.mode ?? "generation")}</div>
                  <div className="text-xs text-[var(--brand-navy)]/55">
                    {g.created_at ? new Date(g.created_at).toLocaleString("fr-FR") : "—"}
                  </div>
                </div>
                <div className="mt-2 line-clamp-2 text-sm text-[var(--brand-navy)]/75">{String(g.input ?? "")}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
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
    <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-medium text-[var(--brand-navy)]/60">{title}</div>
          <div className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] shadow-sm">
          <Icon className="size-5 text-[var(--brand-green)]" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--brand-navy)]/60">
        <span className="font-medium text-[var(--brand-navy)]/70">{delta}</span>
        <span>{deltaLabel}</span>
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
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-[var(--radius)] border bg-white p-4 shadow-sm transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(15,23,42,0.10)] motion-reduce:hover:translate-y-0",
        tone === "primary" ? "border-[var(--brand-green)]/18" : "border-[var(--brand-navy)]/10",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm",
            tone === "primary"
              ? "border-[var(--brand-green)]/22 bg-[rgba(22,163,74,0.08)]"
              : "border-[var(--brand-navy)]/10 bg-[hsl(var(--background))]",
          )}
        >
          <Icon className={cn("size-5", tone === "primary" ? "text-[var(--brand-green)]" : "text-[var(--brand-navy)]")} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--brand-navy)]">{title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-[var(--brand-navy)]/60">{description}</div>
        </div>
      </div>
      <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-[calc(var(--radius)-6px)] bg-[var(--brand-green)]/0 transition-colors group-hover:bg-[var(--brand-green)]/40" />
    </Link>
  );
}
