import Link from "next/link";
import { Check, MessageCircleMore, Sparkles, Zap } from "lucide-react";
import { MarketingShell } from "@/components/site/marketing-shell";
import { HeroDemo } from "@/components/site/hero-demo";
import { LeadCapture } from "@/components/site/lead-capture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <MarketingShell>
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-8 sm:pt-14">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-2 lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" />
                Messages de vente en francais, optimises WhatsApp
              </div>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Tes prospects WhatsApp hesitent trop ? Reponds mieux, vends plus
              </h1>
              <p className="text-base text-muted-foreground sm:text-lg">
                Reponses, relances et scripts de closing prets en 1 clic pour vendre plus vite.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-12 text-base">
                  <Link href="/signup">Essayer gratuitement pendant 7 jours</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-12 text-base">
                  <Link href="/pricing">Voir les tarifs</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Déjà utiliser par vendeurs au Cameroun, Côte d’Ivoire et Sénégal
              </p>
              <div className="rounded-[var(--radius)] border border-[var(--brand-gold)]/30 bg-[rgba(244,163,0,0.10)] p-3 text-sm">
                <span className="font-semibold">Urgence:</span> 50 premiers utilisateurs = acces fondateur a vie a tarif reduit
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-primary" /> 10 generations gratuites / mois
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-primary" /> Ton et style adaptes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-primary" /> Mobile-first
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[calc(var(--radius)-6px)] bg-muted p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageCircleMore className="size-4 text-primary" />
                  Client
                </div>
                <div className="mt-2 rounded-[calc(var(--radius)-6px)] bg-background p-3 text-sm">
                  Bonsoir, c&apos;est combien la robe sur la photo ? Livraison a Douala ?
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                  <Zap className="size-4 text-[var(--brand-gold)]" />
                  Optima Seller AI
                </div>
                <div className="mt-2 space-y-2">
                  <div className="rounded-[calc(var(--radius)-6px)] bg-background p-3 text-sm">
                    Bonsoir ! La robe est a 18 000 FCFA. On livre a Douala en 24h. Quelle taille
                    vous convient (S/M/L) ?
                  </div>
                  <div className="rounded-[calc(var(--radius)-6px)] bg-background p-3 text-sm">
                    Merci pour votre message. La robe est a 18 000 FCFA, et la livraison a Douala
                    est disponible. Vous souhaitez quelle couleur ?
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild className="flex-1">
                  <Link href="/signup">Essayer gratuitement pendant 7 jours</Link>
                </Button>
                <Button asChild variant="secondary" className="flex-1">
                  <Link href="/app">Voir le dashboard</Link>
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Demo cliquable. Activez Supabase pour l&apos;auth et la sauvegarde.
              </p>
              <HeroDemo />
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
              <div className="lg:col-span-2">
                <h2 className="text-xl font-semibold">Chaque prospect ignore sur WhatsApp = argent perdu.</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les vendeurs perdent des ventes chaque jour par manque de reponse rapide. Optima Seller AI vous aide a
                  repondre proprement, relancer sans stresser, et closer quand le client hesite.
                </p>
              </div>
              <LeadCapture />
            </div>
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Repondre vite</CardTitle>
                  <CardDescription>Des reponses claires, polies, vendeuses.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  3 variantes, ton au choix, question de qualification incluse.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Relancer sans stresser</CardTitle>
                  <CardDescription>Relances courtes ou persuasives.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Contexte + prochaine action, sans paraitre insistant.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Closer proprement</CardTitle>
                  <CardDescription>Reponses aux objections frequentes.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Prix, livraison, confiance, urgence: scripts reutilisables.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Ils vendent mieux</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Exemples de retours de marchands francophones.
              </p>
            </div>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href="/pricing">Voir les offres</Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="bg-background">
                <CardHeader>
                  <CardTitle className="text-sm">{t.name}</CardTitle>
                  <CardDescription>{t.location}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="sm:col-span-1">
                <CardHeader>
                  <CardTitle>Gratuit</CardTitle>
                  <CardDescription>Pour commencer</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="text-2xl font-semibold">0 FCFA</div>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />10 generations / mois</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Tous les outils IA</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />CRM mini pipeline</li>
                  </ul>
                  <Button asChild className="w-full" size="lg">
                    <Link href="/signup">Essayer</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="border-primary/40 sm:col-span-1">
                <CardHeader>
                  <CardTitle>Starter</CardTitle>
                  <CardDescription>Pour commencer serieusement</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="text-2xl font-semibold">
                    3 000 <span className="text-base font-medium text-muted-foreground">FCFA / mois</span>
                  </div>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Quota augmente</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Historique complet</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Support prioritaire</li>
                  </ul>
                  <Button asChild className="w-full" size="lg" variant="gold">
                    <Link href="/pricing">Choisir Starter</Link>
                  </Button>
                </CardContent>
              </Card>
              <Card className="sm:col-span-1">
                <CardHeader>
                  <CardTitle>Pro</CardTitle>
                  <CardDescription>Pour vendre tous les jours</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="text-2xl font-semibold">
                    5 000 <span className="text-base font-medium text-muted-foreground">FCFA / mois</span>
                  </div>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Quota tres eleve</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Priorite nouvelles fonctions</li>
                    <li className="flex items-center gap-2"><Check className="size-4 text-primary" />Support premium</li>
                  </ul>
                  <Button asChild className="w-full" size="lg" variant="outline">
                    <Link href="/pricing">Voir details</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
            <div className="mt-4 rounded-[var(--radius)] border bg-background p-4 text-sm">
              <span className="font-semibold">Business:</span> 10 000 FCFA / mois (pour equipes et volume) sur la page Tarifs.
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-xl font-semibold">FAQ</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FAQ.map((f) => (
              <Card key={f.q}>
                <CardHeader>
                  <CardTitle className="text-sm">{f.q}</CardTitle>
                  <CardDescription>{f.a}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

const TESTIMONIALS = [
  {
    name: "Nadine",
    location: "Douala, Cameroun",
    quote: "Je reponds plus vite, et mes clients demandent moins de details. J'ai gagne du temps.",
  },
  {
    name: "Ismael",
    location: "Abidjan, Cote d'Ivoire",
    quote: "Les relances sont propres. Je convertis mieux sans harceler.",
  },
  {
    name: "Awa",
    location: "Dakar, Senegal",
    quote: "Les scripts de closing m'aident quand on me dit 'c'est cher'.",
  },
];

const FAQ = [
  {
    q: "Est-ce que ca marche pour tous les secteurs ?",
    a: "Oui. Vous choisissez votre type de business pour adapter le style des messages.",
  },
  {
    q: "Je dois connecter WhatsApp ?",
    a: "Non. Copiez-collez les messages dans WhatsApp. Integration possible plus tard.",
  },
  {
    q: "C'est en francais ?",
    a: "Oui, concu pour des marchands francophones (Cameroun, CI, Senegal, Benin, Togo, Congo).",
  },
  {
    q: "Comment payer ?",
    a: "Mobile Money arrive. Pour l'instant, bouton placeholder sur la page Tarifs.",
  },
];
