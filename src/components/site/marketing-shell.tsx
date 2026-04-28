import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="focus-visible:outline-none">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" className="hidden sm:inline-flex">
              <Link href="/pricing">Tarifs</Link>
            </Button>
            <Button asChild size="lg" className="h-11">
              <Link href="/signup">Essayer gratuitement pendant 7 jours</Link>
            </Button>
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
          {new Date().getFullYear()} Optima Seller AI. Concu pour les marchands
          francophones d&apos;Afrique.
        </div>
      </footer>
    </div>
  );
}
