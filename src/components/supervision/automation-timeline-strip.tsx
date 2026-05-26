"use client";

import type { SupervisionAutomationTimelineItem } from "@/lib/supervision/supervision-types";

import { formatSupervisionDt } from "./supervision-utils";

export function AutomationTimelineStrip(props: { items: SupervisionAutomationTimelineItem[] }) {
  if (!props.items.length) return null;

  return (
    <div className="overflow-x-auto pb-1">
      <ol className="flex min-w-min gap-3">
        {props.items.slice(0, 8).map((e) => (
          <li
            key={e.id}
            className="w-[200px] shrink-0 rounded-xl border border-black/[0.06] bg-white/80 px-3 py-2.5 dark:bg-card"
          >
            <p className="text-xs font-medium leading-snug text-foreground">{e.label}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{formatSupervisionDt(e.at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
