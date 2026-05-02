import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--brand-navy)]/95 text-white backdrop-blur supports-[backdrop-filter]:bg-[var(--brand-navy)]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="focus-visible:outline-none">
            <BrandLogo size="desktop" className="text-white" />
          </Link>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="hidden border-white/15 bg-transparent text-white hover:bg-white/10 sm:inline-flex"
            >
              <Link href="/pricing">Tarifs</Link>
            </Button>
            <Button asChild size="lg" className="h-11">
              <Link href="/signup">Essayer gratuitement pendant 7 jours</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/10 bg-[var(--brand-navy)] text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-white/70 sm:px-6">
          {new Date().getFullYear()} Optima Seller AI. Conçu pour les marchands
          francophones d&apos;Afrique.
        </div>
      </footer>
    </div>
  );
}
