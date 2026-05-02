"use client";

import Link from "next/link";
import * as React from "react";
import {
  ArrowUpRight,
  Bot,
  MessageSquareReply,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/data/use-profile";
import { useQuota } from "@/lib/data/use-quota";
import { useRecentGenerations } from "@/lib/data/use-generations";
import { createOptionalSupabaseClient } from "@/lib/data/supabase";
import { MemoryBanner } from "@/components/app/memory-banner";
import { StatCard } from "@/components/premium/StatCard";
import { UpgradeButton } from "@/components/premium/UpgradeButton";
import { Badge } from "@/components/premium/Badge";

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

  const userLabel = profile.profile?.full_name?.trim() || profile.profile?.business_name?.trim() || "là";
  const planLabel = quota.plan === "pro" ? "Pro" : "Free";
  const usagePct = quota.loading || !quota.limit ? 0 : Math.min(100, Math.round((quota.used / quota.limit) * 100));

  return (
    <div className="space-y-6 sm:space-y-8">
      <MemoryBanner />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">Bonjour {userLabel}</h1>
            <p className="text-sm text-[var(--brand-navy)]/65 sm:text-base">
              Tout est prêt : quota, historique et mémoire business synchronisés.
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
          <StatCard
            title="Générations restantes"
            value={quota.loading ? "…" : String(quota.remaining)}
            subtitle={quota.loading ? "…" : `${quota.remaining}/${quota.limit} ce mois`}
            icon={Sparkles}
          />
          <StatCard
            title="Plan actuel"
            value={planLabel}
            subtitle={quota.expires_at ? `Expire le ${new Date(quota.expires_at).toLocaleDateString("fr-FR")}` : "Actif"}
            icon={Crown}
            tone={quota.plan === "pro" ? "pro" : "default"}
          />
          <StatCard
            title="Générations utilisées"
            value={quota.loading ? "…" : String(quota.used)}
            subtitle={quota.loading ? "…" : `Utilisation: ${usagePct}%`}
            icon={TrendingUp}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--brand-navy)] sm:text-xl">Actions IA rapides</h2>
          <p className="text-sm text-[var(--brand-navy)]/65">Réponses, relances et scripts — adaptés à votre business.</p>
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

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimelineCard items={recent.items} loading={recent.loading} />
        </div>

        <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-base font-semibold text-[var(--brand-navy)]">Quota & plan</div>
              <div className="text-sm text-[var(--brand-navy)]/60">Suivi simple et actionnable.</div>
            </div>
            <Badge variant={quota.plan === "pro" ? "pro" : "muted"}>{quota.plan === "pro" ? "PRO" : "FREE"}</Badge>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-3">
              <div className="flex items-center justify-between text-xs text-[var(--brand-navy)]/70">
                <span className="font-medium">Utilisation</span>
                <span>{quota.loading ? "…" : `${quota.used}/${quota.limit}`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--brand-navy)]/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(22,163,74,0.90),rgba(22,163,74,0.55))] transition-[width] duration-500"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-[var(--brand-navy)]/60">
                {quota.exhausted ? "Quota épuisé. Upgrade pour continuer." : "Vous êtes bon pour aujourd’hui."}
              </div>
            </div>

            {quota.plan === "pro" ? (
              <Button asChild variant="outline" className="w-full bg-white">
                <Link href="/pricing">Gérer mon plan</Link>
              </Button>
            ) : (
              <UpgradeButton className="w-full justify-center" />
            )}

            <div className="text-xs text-[var(--brand-navy)]/55">
              {memberSince ? `Membre depuis ${new Date(memberSince).toLocaleDateString("fr-FR")}.` : "Compte prêt."}
            </div>
          </div>
        </div>
      </section>
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

