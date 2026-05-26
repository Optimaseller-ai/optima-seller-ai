"use client";

import { Lightbulb } from "lucide-react";

import type { SupervisionDecisionExplanation } from "@/lib/supervision/supervision-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function DecisionExplainer(props: { decisions: SupervisionDecisionExplanation[] }) {
  if (!props.decisions.length) return null;

  return (
    <Card className="border-dashed border-primary/25 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-primary" aria-hidden />
          Pourquoi l’agent a fait ça
        </CardTitle>
        <CardDescription>Explications discrètes — pas un rapport technique.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.decisions.map((d, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-background/80 p-3">
            <p className="text-sm font-medium text-foreground">{d.headline}</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {d.reasons.map((r, j) => (
                <li key={j}>— {r}</li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
