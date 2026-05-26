"use client";

import { Cpu, PlayCircle, ShieldCheck, Zap } from "lucide-react";

import type { SupervisionAgentStatus } from "@/lib/supervision/supervision-types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STATUS_ICON = {
  active: PlayCircle,
  processing: Cpu,
  waiting_approval: ShieldCheck,
  executing_action: Zap,
} as const;

export function LiveAgentStatus(props: { agent: SupervisionAgentStatus; updatedAt?: string }) {
  const Icon = STATUS_ICON[props.agent.status] ?? PlayCircle;

  return (
    <Card className="border-black/[0.06] bg-gradient-to-br from-white via-white to-emerald-50/40 dark:from-card dark:to-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border bg-white/80 shadow-inner dark:bg-white/5">
            <Icon className="size-5 text-emerald-700 dark:text-emerald-400" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Équipe commerciale IA</p>
            <p className="text-lg font-semibold tracking-tight">{props.agent.label}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {props.agent.typing ? <BadgePill>En frappe</BadgePill> : null}
              {props.agent.paused ? <BadgePill tone="amber">Pause humaine</BadgePill> : null}
              {props.agent.followupMode ? <BadgePill tone="violet">Relances actives</BadgePill> : null}
              <BadgePill>Charge {props.agent.loadLabel}</BadgePill>
              <BadgePill>{props.agent.activeConversations} conv.</BadgePill>
            </div>
          </div>
        </div>
        {props.updatedAt ? (
          <p className="text-[11px] tabular-nums text-muted-foreground">Maj. {props.updatedAt}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BadgePill(props: { children: React.ReactNode; tone?: "amber" | "violet" }) {
  return (
    <span
      className={cn(
        "rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground",
        props.tone === "amber" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        props.tone === "violet" && "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
      )}
    >
      {props.children}
    </span>
  );
}
