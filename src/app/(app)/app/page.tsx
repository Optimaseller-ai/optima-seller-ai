import Link from "next/link";
import { ArrowRight, Clock3, MessageCircleMore, Sparkles, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lancez une generation, suivez vos prospects, et fermez plus de ventes.
          </p>
        </div>
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/app/generator">
            Generer <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          title="Reply to client"
          description="Reponse immediate + question de qualification."
          icon={<MessageCircleMore className="size-4 text-primary" />}
          href="/app/generator?tab=reply"
        />
        <QuickAction
          title="Follow up prospect"
          description="Relance courte ou persuasive."
          icon={<Clock3 className="size-4 text-primary" />}
          href="/app/generator?tab=followup"
        />
        <QuickAction
          title="Closing script"
          description="Repondre aux objections et closer."
          icon={<Zap className="size-4 text-[var(--brand-gold)]" />}
          href="/app/generator?tab=closing"
        />
        <QuickAction
          title="WhatsApp status ideas"
          description="5 idees de statuts vendeurs."
          icon={<Sparkles className="size-4 text-primary" />}
          href="/app/generator?tab=status"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Quota</CardTitle>
            <CardDescription>Version Free par defaut.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-3xl font-semibold">10</div>
            <div className="text-sm text-muted-foreground">generations / mois (demo)</div>
            <Button asChild variant="gold" size="lg" className="w-full">
              <Link href="/pricing">Passer en Pro</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent generations</CardTitle>
            <CardDescription>Historique (demo UI). Branchez Supabase pour stocker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {RECENT.map((g) => (
              <div key={g.id} className="flex items-start justify-between gap-3 rounded-[var(--radius)] border bg-background p-3">
                <div>
                  <div className="text-sm font-medium">{g.type}</div>
                  <div className="text-sm text-muted-foreground line-clamp-2">{g.preview}</div>
                </div>
                <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="size-3.5" /> {g.time}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Card className="hover:border-primary/30 transition">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full" size="lg">
          <Link href={href}>
            Ouvrir <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const RECENT = [
  {
    id: "1",
    type: "Reply",
    preview: "Bonsoir ! La robe est a 18 000 FCFA. On livre a Douala en 24h. Quelle taille vous convient ?",
    time: "Il y a 2 h",
  },
  {
    id: "2",
    type: "Follow-up",
    preview: "Bonjour ! Je me permets de relancer: vous souhaitez toujours la livraison aujourd'hui ou demain ?",
    time: "Hier",
  },
  {
    id: "3",
    type: "Closing",
    preview: "Je comprends. Pour vous rassurer, paiement a la livraison possible. On valide la commande ?",
    time: "Il y a 3 j",
  },
];

