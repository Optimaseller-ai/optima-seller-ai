import Link from "next/link";
import { Inter, Poppins } from "next/font/google";
import type React from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  MessageCircle,
  Phone,
  Sparkles,
  Timer,
  TrendingUp,
} from "lucide-react";
import { UnifiedNavbar } from "@/components/nav/unified-navbar";
import { Button } from "@/components/ui/button";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-home-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-home-poppins",
});

export default function HomePage() {
  return (
    <div
      className={`${inter.variable} ${poppins.variable} min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] [font-family:var(--font-home-inter),var(--font-sans)]`}
    >
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_20%_10%,rgba(22,163,74,0.12),transparent_60%),radial-gradient(56rem_40rem_at_90%_0%,rgba(245,158,11,0.12),transparent_55%),radial-gradient(48rem_36rem_at_70%_90%,rgba(15,23,42,0.10),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <UnifiedNavbar />

      <main>
        {/* SECTION 1 HERO */}
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
                <Button
                  asChild
                  size="lg"
                  className="h-12 px-6 text-base font-medium sm:h-11 sm:text-sm"
                >
                  <Link href="/signup">
                    Commencer gratuitement <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 border-[var(--brand-navy)]/15 bg-white/70 text-[var(--brand-navy)] hover:bg-white sm:h-11 sm:text-sm"
                >
                  <Link href="/app/generator">Voir la démo</Link>
                </Button>
              </div>

              <p className="text-sm text-[var(--brand-navy)]/60">Aucune carte bancaire requise</p>

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

        {/* SECTION 2 TRUST BAR */}
        <section className="border-y border-[var(--brand-navy)]/10 bg-white/60">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-sm font-medium text-[var(--brand-navy)]">
                Déjà adopté par entrepreneurs, freelances et PME
              </p>
              <div className="flex items-center gap-2">
                {TRUST_PEOPLE.map((p) => (
                  <div
                    key={p.name}
                    className="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] shadow-sm transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
                    aria-label={p.name}
                    title={p.name}
                  >
                    <div className="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_30%_20%,rgba(22,163,74,0.18),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(245,158,11,0.18),transparent_55%)]" />
                    <span className="relative text-xs font-semibold text-[var(--brand-navy)]">
                      {p.initials}
                    </span>
                  </div>
                ))}
                <div className="ml-1 hidden items-center gap-2 rounded-full border border-[var(--brand-navy)]/10 bg-white/70 px-3 py-1 text-xs text-[var(--brand-navy)]/70 shadow-sm sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-green)]" />
                  Support rapide • Onboarding simple
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3 BENEFITS */}
        <section className="bg-transparent">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="max-w-2xl space-y-2">
              <h2 className="[font-family:var(--font-home-poppins),var(--font-home-inter),var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--brand-navy)] sm:text-3xl">
                Faites confiance à chaque réponse
              </h2>
              <p className="text-sm leading-relaxed text-[var(--brand-navy)]/70 sm:text-base">
                Un ton professionnel, des relances qui convertissent, et une expérience client cohérente — même quand vous êtes occupé.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <BenefitCard
                title="Réponse client instantanée"
                description="Répondez en quelques secondes, avec une formulation claire et rassurante."
                icon={MessageCircle}
              />
              <BenefitCard
                title="Relance prospects automatique"
                description="Relances courtes, respectueuses, orientées prochaine action — sans stress."
                icon={Bot}
              />
              <BenefitCard
                title="Plus de ventes sur WhatsApp"
                description="De meilleures conversations, moins de prospects perdus, plus de conversions."
                icon={TrendingUp}
              />
            </div>
          </div>
        </section>

        {/* SECTION 4 BEFORE / AFTER */}
        <section className="border-y border-[var(--brand-navy)]/10 bg-white/55">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="grid gap-4 lg:grid-cols-2">
              <BeforeAfterCard
                tone="before"
                title="Avant"
                subtitle="Réponses lentes, clients perdus"
                points={[
                  "Messages hésitants ou incomplets",
                  "Prospects laissés en “vu”",
                  "Ventes perdues faute de suivi",
                ]}
              />
              <BeforeAfterCard
                tone="after"
                title="Après"
                subtitle="Réponses pro, prospects convertis"
                points={[
                  "Ton pro, clair et rassurant",
                  "Relances automatiques bien dosées",
                  "Plus de closes sur WhatsApp",
                ]}
              />
            </div>
          </div>
        </section>

        {/* SECTION 5 TESTIMONIAL */}
        <section className="bg-transparent">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <div className="rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white/70 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.10)] sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl space-y-3">
                  <p className="text-sm font-medium text-[var(--brand-navy)]/70">Témoignage</p>
                  <p className="text-lg leading-relaxed text-[var(--brand-navy)] sm:text-xl">
                    “Depuis Optima, je réponds à mes clients même pendant les livraisons. Le ton est plus pro, et je récupère
                    beaucoup plus de prospects qui hésitaient. Sur WhatsApp, ça change tout.”
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] shadow-sm">
                      <div className="absolute inset-0 [background:radial-gradient(circle_at_30%_30%,rgba(22,163,74,0.25),transparent_55%),radial-gradient(circle_at_70%_80%,rgba(245,158,11,0.25),transparent_55%)]" />
                      <span className="relative flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--brand-navy)]">
                        AM
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="font-semibold text-[var(--brand-navy)]">Aïcha M.</div>
                      <div className="text-[var(--brand-navy)]/60">Boutique mode • Libreville</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:w-[260px]">
                  <MiniStat label="Temps de réponse" value="↓ 70%" />
                  <MiniStat label="Prospects relancés" value="+ 2×" />
                  <MiniStat label="Ventes WhatsApp" value="+ 18%" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 FINAL CTA */}
        <section className="pb-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-[var(--brand-navy)] px-6 py-10 text-white shadow-[0_18px_45px_rgba(15,23,42,0.25)] sm:px-10 sm:py-12">
              <div className="pointer-events-none absolute inset-0 opacity-80">
                <div className="absolute -top-28 left-[-4rem] h-72 w-72 rounded-full bg-[var(--brand-green)]/25 blur-3xl" />
                <div className="absolute -bottom-32 right-[-5rem] h-80 w-80 rounded-full bg-[var(--brand-gold)]/20 blur-3xl" />
              </div>

              <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="space-y-2">
                  <h2 className="[font-family:var(--font-home-poppins),var(--font-home-inter),var(--font-sans)] text-2xl font-semibold tracking-tight sm:text-3xl">
                    Prêt à vendre plus avec l’IA ?
                  </h2>
                  <p className="text-sm text-white/75 sm:text-base">
                    Lancez un essai gratuit et voyez l’impact dès vos prochaines conversations WhatsApp.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 bg-white text-[var(--brand-navy)] hover:bg-white/90 sm:h-11"
                  >
                    <Link href="/signup">Essai gratuit 7 jours</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 border-white/20 bg-transparent text-white hover:bg-white/10 sm:h-11"
                  >
                    <Link href="/pricing">Voir les tarifs</Link>
                  </Button>
                </div>
              </div>
            </div>

            <footer className="mt-10 border-t border-[var(--brand-navy)]/10 pt-8 text-sm text-[var(--brand-navy)]/60">
              {new Date().getFullYear()} Optima Seller AI. Conçu pour les marchands francophones d’Afrique.
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}

function BenefitCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white/70 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_16px_45px_rgba(15,23,42,0.12)] motion-reduce:hover:translate-y-0">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [background:radial-gradient(50rem_30rem_at_20%_10%,rgba(22,163,74,0.10),transparent_55%),radial-gradient(46rem_30rem_at_90%_60%,rgba(245,158,11,0.10),transparent_55%)]" />
      <div className="relative space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--brand-navy)]/10 bg-white shadow-sm">
          <Icon className="size-5 text-[var(--brand-green)]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-[var(--brand-navy)]">{title}</h3>
          <p className="text-sm leading-relaxed text-[var(--brand-navy)]/70">{description}</p>
        </div>
      </div>
    </div>
  );
}

function BeforeAfterCard({
  tone,
  title,
  subtitle,
  points,
}: {
  tone: "before" | "after";
  title: string;
  subtitle: string;
  points: string[];
}) {
  const accent =
    tone === "after" ? "rgba(22,163,74,0.12)" : "rgba(15,23,42,0.06)";
  const border =
    tone === "after" ? "border-[var(--brand-green)]/20" : "border-[var(--brand-navy)]/10";
  const badge =
    tone === "after" ? "bg-[var(--brand-green)] text-white" : "bg-[var(--brand-navy)] text-white";

  return (
    <div className={`relative overflow-hidden rounded-[var(--radius)] border ${border} bg-white/70 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)]`}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(50rem 35rem at 20% 10%, ${accent}, transparent 55%)`,
        }}
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${badge}`}>
            {title}
          </div>
          <div className="inline-flex items-center gap-2 text-xs text-[var(--brand-navy)]/60">
            <Phone className="size-4" />
            WhatsApp
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--brand-navy)]">{subtitle}</h3>
        </div>
        <ul className="space-y-2 text-sm text-[var(--brand-navy)]/70">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-gold)]" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-4 shadow-sm">
      <div className="text-xs font-medium text-[var(--brand-navy)]/60">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[var(--brand-navy)]">{value}</div>
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
              <span className="relative flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--brand-navy)]">
                CK
              </span>
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
          <Bubble from="customer">
            Bonjour, c’est combien le pack ? Vous livrez à Libreville ?
          </Bubble>
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

      <p className="mt-3 text-center text-xs text-[var(--brand-navy)]/55">
        Démo visuelle — l’expérience est optimisée mobile-first.
      </p>
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
          isAI
            ? "border border-[var(--brand-navy)]/10 bg-white text-[var(--brand-navy)]"
            : "border border-[var(--brand-green)]/15 bg-[rgba(22,163,74,0.10)] text-[var(--brand-navy)]",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

const TRUST_PEOPLE = [
  { name: "Entrepreneur", initials: "EN" },
  { name: "Freelance", initials: "FR" },
  { name: "PME", initials: "PM" },
  { name: "E-commerce", initials: "EC" },
  { name: "Services", initials: "SV" },
] as const;
