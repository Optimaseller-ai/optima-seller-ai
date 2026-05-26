"use client";

import { Cpu, PlayCircle, ShieldCheck, Zap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentLiveStatus } from "@/lib/agent-control-panel/snapshot-types";

const STATUS_META: Record<
  AgentLiveStatus,
  { label: string; tone: string; Icon: typeof Zap }
> = {
  active: {
    label: "Actif",
    tone: "text-emerald-700 dark:text-emerald-400",
    Icon: PlayCircle,
  },
  processing: {
    label: "Traitement",
    tone: "text-amber-700 dark:text-amber-400",
    Icon: Cpu,
  },
  waiting_approval: {
    label: "En attente de validation",
    tone: "text-violet-700 dark:text-violet-300",
    Icon: ShieldCheck,
  },
  executing_action: {
    label: "Exécution d’action",
    tone: "text-sky-700 dark:text-sky-300",
    Icon: Zap,
  },
};

export function LiveAgentStatusBar(props: { status: AgentLiveStatus; detail: string; updatedAt: string }) {
  const meta = STATUS_META[props.status];
  const Icon = meta.Icon;

  return (
    <Card className="border-black/[0.06] bg-gradient-to-br from-white via-white to-[rgba(22,163,74,0.06)] shadow-[0_22px_60px_rgba(15,23,42,0.08)] dark:from-card dark:to-card dark:shadow-none">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80 shadow-inner dark:bg-white/5",
            )}
          >
            <Icon className={cn("size-5", meta.tone)} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              État agent en direct
            </p>
            <p className={cn("mt-1 truncate text-lg font-semibold tracking-tight", meta.tone)}>{meta.label}</p>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">{props.detail}</p>
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 py-2 text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Flux snapshot</p>
          <p className="text-xs tabular-nums text-foreground">{props.updatedAt}</p>
        </div>
      </CardContent>
    </Card>
  );
}
