import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { UnifiedNavbarServer } from "@/components/nav/unified-navbar-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProSuccessPage() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <UnifiedNavbarServer />

      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Card className="border-[var(--brand-green)]/22 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.14)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[var(--brand-navy)]">
              <PartyPopper className="size-5 text-[var(--brand-gold)]" />
              Bienvenue dans Optima Pro 🎉
            </CardTitle>
            <CardDescription>Votre compte a été upgradé avec succès.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="h-11 w-full">
              <Link href="/app">Utiliser maintenant</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
