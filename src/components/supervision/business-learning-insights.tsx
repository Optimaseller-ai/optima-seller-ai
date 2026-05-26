"use client";

import * as React from "react";
import { BookOpen, Clock, MessageSquare, Package, RefreshCw, Sparkles, TrendingUp } from "lucide-react";

import type { BusinessLearningAdminView } from "@/lib/learning/learning-admin-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function BusinessLearningInsights() {
  const [data, setData] = React.useState<BusinessLearningAdminView | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/supervision/learning", { credentials: "include", cache: "no-store" });
      const js = await res.json().catch(() => ({}));
      if (res.ok) setData(js as BusinessLearningAdminView);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <Card className="border-black/[0.06]">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">Chargement des apprentissages…</CardContent>
      </Card>
    );
  }

  if (!data || data.memory.totalObservations < 1) {
    return (
      <Card className="border-dashed border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="size-4 text-primary" aria-hidden />
            Ce que vos agents apprennent
          </CardTitle>
          <CardDescription>
            Après quelques conversations, vous verrez ici les réponses efficaces, produits stars et créneaux forts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section id="apprentissage" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Intelligence terrain</h2>
          <p className="text-sm text-muted-foreground">
            Vos commerciaux IA s’améliorent chaque semaine — basé sur {data.memory.totalObservations} interactions réelles.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
          Actualiser
        </Button>
      </div>

      {data.insights.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.insights.map((i) => (
            <li
              key={i.id}
              className="flex gap-2 rounded-2xl border border-black/[0.06] bg-white/90 px-4 py-3 text-sm dark:bg-card"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="leading-snug text-foreground">{i.text}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Confiance {i.confidence}% · {i.sampleSize} échantillon{i.sampleSize > 1 ? "s" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          icon={MessageSquare}
          title="Meilleures réponses"
          empty="Pas encore assez de données."
          items={data.topResponses.map((r) => ({
            primary: `« ${r.phrase.slice(0, 70)}${r.phrase.length > 70 ? "…" : ""} »`,
            meta: `${r.score}% · ${r.samples} fois`,
          }))}
        />
        <InsightCard
          icon={TrendingUp}
          title="Closings efficaces"
          empty="Les formulations de closing apparaîtront ici."
          items={data.topClosings.map((r) => ({
            primary: `« ${r.phrase.slice(0, 70)}${r.phrase.length > 70 ? "…" : ""} »`,
            meta: `${r.score}% succès`,
          }))}
        />
        <InsightCard
          icon={Package}
          title="Produits performants"
          empty="Aucun produit dominant pour l’instant."
          items={data.topProducts.map((p) => ({
            primary: p.name,
            meta: `${p.mentions} demandes · ${p.conversions} conversions`,
          }))}
        />
        <InsightCard
          icon={Clock}
          title="Heures fortes"
          empty="Créneaux horaires en cours d’analyse."
          items={data.bestHours.map((h) => ({
            primary: h.label,
            meta: `${h.conversionRate}% conversion · ${h.samples} conv.`,
          }))}
        />
        <InsightCard
          icon={RefreshCw}
          title="Relances efficaces"
          empty="Les délais de relance optimaux s’affineront avec le temps."
          items={data.topFollowups.map((f) => ({
            primary: f.label,
            meta: `${f.successRate}% réponses · ${f.samples} relances`,
          }))}
        />
        <InsightCard
          icon={BookOpen}
          title="Objections fréquentes"
          empty="Peu d’objections recensées."
          items={data.topObjections.map((o) => ({
            primary: labelObjection(o.kind),
            meta: `${o.frequency} fois`,
          }))}
        />
      </div>
    </section>
  );
}

function labelObjection(kind: string): string {
  const m: Record<string, string> = {
    price: "Prix",
    trust: "Confiance",
    delivery: "Livraison",
    quality: "Qualité",
    delay: "Délai",
    other: "Autre",
  };
  return m[kind] ?? kind;
}

function InsightCard(props: {
  icon: typeof MessageSquare;
  title: string;
  empty: string;
  items: { primary: string; meta: string }[];
}) {
  const Icon = props.icon;
  return (
    <Card className="border-black/[0.06] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {props.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {props.items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{props.empty}</p>
        ) : (
          <ul className="space-y-2">
            {props.items.map((item, i) => (
              <li key={i} className="rounded-xl bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium leading-snug">{item.primary}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{item.meta}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
