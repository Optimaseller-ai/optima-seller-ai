"use client";

import type { SupervisionAutomationHub } from "@/lib/supervision/supervision-types";
import { cn } from "@/lib/utils";

export function AutomationQueuePulse(props: { pulse: SupervisionAutomationHub["pulse"]; alerts: SupervisionAutomationHub["automationAlerts"] }) {
  const p = props.pulse;
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-violet-50/30 p-4 dark:from-card dark:to-violet-950/20">
      <p className="text-base font-semibold tracking-tight text-foreground">{p.headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{p.subline}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {p.awaitingYou > 0 ? <Chip label={`${p.awaitingYou} pour vous`} tone="amber" /> : null}
        {p.inProgress > 0 ? <Chip label={`${p.inProgress} en cours`} tone="emerald" /> : null}
        {p.scheduled > 0 ? <Chip label={`${p.scheduled} planifiée${p.scheduled > 1 ? "s" : ""}`} tone="violet" /> : null}
        {p.queued > 0 && p.awaitingYou === 0 ? <Chip label={`${p.queued} en file`} tone="muted" /> : null}
      </div>
      {props.alerts.length ? (
        <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {props.alerts.map((a) => (
            <li
              key={a.id}
              className={cn(
                "text-xs",
                a.tone === "attention" && "text-amber-800 dark:text-amber-200",
                a.tone === "info" && "text-muted-foreground",
                a.tone === "muted" && "text-muted-foreground/80",
              )}
            >
              {a.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Chip(props: { label: string; tone: "amber" | "emerald" | "violet" | "muted" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
        props.tone === "amber" && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
        props.tone === "emerald" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
        props.tone === "violet" && "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
        props.tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {props.label}
    </span>
  );
}
