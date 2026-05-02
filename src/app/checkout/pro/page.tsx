import Image from "next/image";
import { Zap, Sparkles, Layers, Brain, Headset, BadgeCheck } from "lucide-react";
import { UnifiedNavbarServer } from "@/components/nav/unified-navbar-server";
import { StartLeekPayCheckoutButton } from "@/components/premium/start-leekpay-checkout-button";

const BENEFITS = [
  { icon: Zap, title: "IA plus rapide", desc: "Réponses instantanées et plus précises" },
  { icon: Sparkles, title: "2000 générations / mois", desc: "Quota augmenté pour booster vos ventes" },
  { icon: Layers, title: "Multi modèles IA", desc: "GPT, Claude, Gemini… et plus" },
  { icon: Brain, title: "Réponses plus intelligentes", desc: "Closing assisté + relances" },
  { icon: Headset, title: "Priorité support", desc: "Accompagnement dédié et rapide" },
] as const;

export default function ProCheckoutPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(56rem_38rem_at_15%_10%,rgba(22,163,74,0.14),transparent_55%),radial-gradient(52rem_36rem_at_90%_0%,rgba(245,158,11,0.12),transparent_55%),radial-gradient(46rem_36rem_at_70%_90%,rgba(15,23,42,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,rgba(15,23,42,0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.55)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <UnifiedNavbarServer />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <section className="overflow-hidden rounded-[28px] border border-[var(--brand-navy)]/10 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.10)]">
          <div className="relative p-5 sm:p-7">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(48rem_30rem_at_20%_0%,rgba(22,163,74,0.10),transparent_60%)]" />

            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-green)]/18 bg-[rgba(22,163,74,0.08)] px-3 py-1 text-xs font-semibold text-[var(--brand-green)]">
              Abonnement Pro
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-4xl">
              Passez Pro et <span className="text-[var(--brand-green)]">vendez plus sur WhatsApp</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--brand-navy)]/65 sm:text-base">
              Réponses IA premium, relances automatiques, closing assisté, quota augmenté.
            </p>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="relative overflow-hidden rounded-3xl border border-[var(--brand-navy)]/10 bg-[rgba(248,250,252,0.85)] p-3 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(36rem_22rem_at_10%_0%,rgba(22,163,74,0.12),transparent_55%)]" />
                <Image
                  src="/images/optima-pro-checkout.png"
                  alt="Optima Pro"
                  width={1200}
                  height={900}
                  priority
                  className="h-auto w-full rounded-2xl animate-[fadeUp_600ms_ease-out]"
                />
              </div>

              <div className="space-y-3">
                <div className="rounded-3xl border border-[var(--brand-navy)]/10 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] animate-[fadeUp_700ms_ease-out]">
                  <div className="text-xs font-semibold text-[var(--brand-navy)]/55">Performance ce mois</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-3xl font-semibold tracking-tight text-[var(--brand-green)]">+126%</div>
                    <div className="rounded-full border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.08)] px-3 py-1 text-[11px] font-medium text-[var(--brand-green)]">
                      +48 commandes
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.06)]">
                    <div className="h-full w-[70%] rounded-full bg-[var(--brand-green)]" />
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--brand-navy)]/10 bg-white p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)] animate-[fadeUp_780ms_ease-out]">
                  <div className="text-xs font-semibold text-[var(--brand-navy)]/55">Quota IA</div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">2000 / 2000</div>
                    <div className="text-xs font-medium text-[var(--brand-navy)]/55">générations ce mois</div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.06)]">
                    <div className="h-full w-full rounded-full bg-[var(--brand-green)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map(({ icon: Icon, title, desc }, idx) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[var(--brand-navy)]/10 bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] animate-[fadeUp_600ms_ease-out]"
                  style={{ animationDelay: `${180 + idx * 50}ms` }}
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(22,163,74,0.10)] text-[var(--brand-green)]">
                    <Icon className="size-5" />
                  </div>
                  <div className="mt-3 text-sm font-semibold text-[var(--brand-navy)]">{title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-[var(--brand-navy)]/60">{desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--brand-green)]/18 bg-[rgba(22,163,74,0.08)] p-4 text-[var(--brand-navy)] shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[var(--brand-green)] shadow-sm">
                <BadgeCheck className="size-5" />
              </span>
              <div>
                <div className="text-sm font-semibold">Déjà adopté par entrepreneurs africains</div>
                <div className="text-xs text-[var(--brand-navy)]/60">Rejoignez la communauté Optima Pro dès aujourd’hui.</div>
              </div>
            </div>
          </div>
        </section>

        <aside className="sticky top-24 space-y-4">
          <div className="rounded-[28px] border border-[var(--brand-navy)]/10 bg-white p-5 shadow-[0_22px_60px_rgba(15,23,42,0.10)] sm:p-6">
            <div className="text-sm font-semibold text-[var(--brand-navy)]">Paiement</div>
            <div className="mt-1 text-xs text-[var(--brand-navy)]/60">3000 FCFA / mois • Annulable à tout moment</div>

            <div className="mt-4 rounded-2xl border border-[var(--brand-navy)]/10 bg-[rgba(15,23,42,0.02)] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--brand-navy)]/70">Total</span>
                <span className="font-semibold text-[var(--brand-navy)]">3000 FCFA</span>
              </div>
              <div className="mt-1 text-xs text-[var(--brand-navy)]/55">
                LeekPay peut ajouter des frais selon le mode de paiement.
              </div>
            </div>

            <div className="mt-4">
              <StartLeekPayCheckoutButton />
              <div className="mt-3 text-center text-xs text-[var(--brand-navy)]/55">
                Paiement sécurisé par LeekPay • Retour automatique après paiement
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
