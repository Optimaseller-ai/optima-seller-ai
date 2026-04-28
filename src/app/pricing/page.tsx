import Link from "next/link";
import { Check, CreditCard } from "lucide-react";
import { MarketingShell } from "@/components/site/marketing-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PricingPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Tarifs</h1>
          <p className="text-sm text-muted-foreground">
            Commencez gratuitement. Essayez 7 jours puis choisissez le plan adapte.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <PlanCard
            name="Free"
            price="0"
            suffix="FCFA / mois"
            features={["10 generations / mois", "Outils IA complets", "Mini CRM pipeline"]}
            cta={
              <Button asChild className="w-full" size="lg">
                <Link href="/signup">Creer un compte</Link>
              </Button>
            }
          />
          <PlanCard
            highlight
            name="Starter"
            price="3 000"
            suffix="FCFA / mois"
            features={["Quota eleve", "Historique complet", "Support prioritaire"]}
            cta={
              <div className="space-y-2">
                <Button className="w-full" size="lg" variant="gold">
                  <CreditCard className="size-4" />
                  Payer Mobile Money (bientot)
                </Button>
                <Button asChild className="w-full" size="lg" variant="secondary">
                  <Link href="/signup">Essayer d&apos;abord</Link>
                </Button>
              </div>
            }
          />
          <PlanCard
            name="Pro"
            price="5 000"
            suffix="FCFA / mois"
            features={["Quota tres eleve", "Priorite nouvelles fonctions", "Support premium"]}
            cta={
              <Button className="w-full" size="lg" variant="outline">
                <CreditCard className="size-4" />
                Payer Mobile Money (bientot)
              </Button>
            }
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Business</CardTitle>
              <CardDescription>Equipes et volume</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="text-3xl font-semibold">
                10 000 <span className="text-base font-medium text-muted-foreground">FCFA / mois</span>
              </div>
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Quota tres eleve</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Multi-boutiques (bientot)</li>
                <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Options equipe</li>
              </ul>
              <Button className="w-full" size="lg" variant="gold">
                <CreditCard className="size-4" />
                Payer Mobile Money (bientot)
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-[rgba(244,163,0,0.10)] border-[var(--brand-gold)]/30">
            <CardHeader>
              <CardTitle>Offre fondateur</CardTitle>
              <CardDescription>Limitee aux 50 premiers utilisateurs</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Acces fondateur a vie a tarif reduit. Inscrivez-vous maintenant pour etre dans les premiers.
              <div className="mt-3">
                <Button asChild className="w-full" size="lg">
                  <Link href="/signup">Essayer gratuitement pendant 7 jours</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Les paiements et le controle strict des quotas seront actives apres integration Mobile Money et Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pour l&apos;instant, l&apos;app est totalement utilisable en mode demo si vous n&apos;avez pas configure les variables
            Supabase.
          </CardContent>
        </Card>
      </main>
    </MarketingShell>
  );
}

function PlanCard({
  name,
  price,
  suffix,
  features,
  cta,
  highlight,
}: {
  name: string;
  price: string;
  suffix: string;
  features: string[];
  cta: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{highlight ? "Le plus choisi" : "Simple et clair"}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-semibold">
          {price} <span className="text-base font-medium text-muted-foreground">{suffix}</span>
        </div>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              {f}
            </li>
          ))}
        </ul>
        {cta}
      </CardContent>
    </Card>
  );
}
