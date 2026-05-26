"use client";

import type { ProspectIntelligenceSnapshot } from "@/lib/supervision/supervision-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { temperatureTone } from "./supervision-utils";

export function ProspectIntelligencePanel(props: {
  prospect: ProspectIntelligenceSnapshot;
  prospectName?: string;
}) {
  const p = props.prospect;
  return (
    <Card className="border-black/[0.06] shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{props.prospectName ?? "Intelligence prospect"}</CardTitle>
        <CardDescription>Humeur, objections, confiance et habitudes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Stat label="Température" value={p.temperature} className={temperatureTone(p.temperature)} />
        <Stat label="Confiance" value={p.trustLevel01 != null ? `${Math.round(p.trustLevel01 * 100)}%` : "—"} />
        <Stat label="Fidélité (score)" value={String(p.loyaltyScore)} />
        <Stat label="Humeur" value={p.mood ?? "—"} />
        {p.activeHourHint ? <Stat label="Activité" value={p.activeHourHint} className="sm:col-span-2" /> : null}
        {p.objections.length ? (
          <div className="sm:col-span-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">Objections</p>
            <p className="mt-1 text-sm">{p.objections.join(" · ")}</p>
          </div>
        ) : null}
        {p.likedProducts.length ? (
          <div className="sm:col-span-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">Produits aimés</p>
            <p className="mt-1 text-sm">{p.likedProducts.join(", ")}</p>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <p className="text-[10px] font-medium uppercase text-muted-foreground">Historique</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.interactionSummary}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat(props: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold", props.className)}>{props.value}</p>
    </div>
  );
}
