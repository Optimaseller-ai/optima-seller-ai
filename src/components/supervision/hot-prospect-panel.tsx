"use client";

import { Flame } from "lucide-react";

import type { HotProspectItem } from "@/lib/supervision/supervision-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatSupervisionDt } from "./supervision-utils";

export function HotProspectPanel(props: {
  items: HotProspectItem[];
  selectedId?: string | null;
  onSelect?: (conversationId: string) => void;
}) {
  return (
    <Card className="border-black/[0.06] shadow-[0_18px_50px_rgba(15,23,42,0.05)] dark:shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flame className="size-4 text-orange-600" aria-hidden />
          Prospects chauds
        </CardTitle>
        <CardDescription>Score achat, urgence et dernière action IA.</CardDescription>
      </CardHeader>
      <CardContent>
        {props.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun prospect chaud pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {props.items.map((p) => {
              const active = props.selectedId === p.conversationId;
              return (
                <li key={p.conversationId}>
                  <button
                    type="button"
                    onClick={() => props.onSelect?.(p.conversationId)}
                    className={cn(
                      "w-full rounded-2xl border p-3 text-left transition hover:bg-muted/30",
                      active && "border-orange-300/60 bg-orange-50/50 dark:bg-orange-950/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">{p.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.urgencyLabel}</p>
                      </div>
                      <span className="rounded-lg bg-orange-100 px-2 py-0.5 text-xs font-bold tabular-nums text-orange-900 dark:bg-orange-950 dark:text-orange-200">
                        {p.salesScore}
                      </span>
                    </div>
                    {p.lastProduct ? (
                      <p className="mt-2 text-xs text-muted-foreground">Dernier focus : {p.lastProduct}</p>
                    ) : null}
                    {p.lastAiAction ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">IA : {p.lastAiAction}</p>
                    ) : null}
                    <p className="mt-2 text-[10px] text-muted-foreground">{formatSupervisionDt(p.lastActivityAt)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
