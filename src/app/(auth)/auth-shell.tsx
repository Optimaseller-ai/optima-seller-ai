import { BrandLogo } from "@/components/brand/logo";
import {
  BadgeCheck,
  MessageCircleMore,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

export function AuthShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60rem_40rem_at_20%_10%,rgba(22,163,74,0.12),transparent_60%),radial-gradient(56rem_40rem_at_90%_0%,rgba(245,158,11,0.12),transparent_55%),radial-gradient(48rem_36rem_at_70%_90%,rgba(15,23,42,0.08),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_right,rgba(15,23,42,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.6)_1px,transparent_1px)] [background-size:40px_40px]" />
      </div>

      <div className="mx-auto grid min-h-screen max-w-6xl items-stretch gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-10">
        {/* Mobile-first: auth card first */}
        <div className="order-1 flex items-center lg:order-2">
          <div className="w-full">{children}</div>
        </div>

        <div className="order-2 hidden lg:flex lg:order-1">
          <div className="w-full rounded-[var(--radius)] border border-[var(--brand-navy)]/10 bg-white/70 p-10 shadow-[0_22px_60px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-3">
              <BrandLogo size="desktop" className="text-[var(--brand-navy)]" />
            </div>

            <div className="mt-8 space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--brand-navy)]">
                Votre assistant IA pour vendre sur WhatsApp
              </h1>
              <p className="text-[var(--brand-navy)]/70">
                Répondez vite, rassurez vos prospects et concluez plus de ventes.
              </p>
            </div>

            <div className="mt-8 space-y-3 text-sm text-[var(--brand-navy)]/75">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-[var(--brand-green)]" />
                Réponses instantanées
              </div>
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-[var(--brand-gold)]" />
                Relances intelligentes
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[var(--brand-navy)]" />
                Plus de conversions
              </div>
            </div>

            <div className="mt-10 rounded-[calc(var(--radius)+8px)] border border-[var(--brand-navy)]/10 bg-[hsl(var(--background))] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--brand-navy)]/70">
                  <MessageCircleMore className="size-4 text-[var(--brand-green)]" />
                  WhatsApp (aperçu)
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-navy)]/10 bg-white px-3 py-1 text-xs font-medium text-[var(--brand-navy)]/70">
                  <Sparkles className="size-3.5 text-[var(--brand-gold)]" />
                  Premium
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl border border-[var(--brand-green)]/20 bg-[rgba(22,163,74,0.10)] px-4 py-3 text-sm text-[var(--brand-navy)]">
                  Bonsoir, c&apos;est combien ? Livraison à Yaoundé ?
                </div>
                <div className="max-w-[85%] rounded-2xl border border-[var(--brand-navy)]/10 bg-white px-4 py-3 text-sm text-[var(--brand-navy)]">
                  Bonsoir 👋 Oui c&apos;est disponible. Le prix est 18 000 FCFA, livraison 24–48h à Yaoundé. Vous le
                  souhaitez en S, M ou L ?
                </div>
              </div>
            </div>

            <p className="mt-6 text-xs text-[var(--brand-navy)]/55">
              Aucune carte bancaire requise. Vos données restent privées.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
