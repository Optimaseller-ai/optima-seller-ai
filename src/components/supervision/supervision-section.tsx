"use client";

import { cn } from "@/lib/utils";

export function SupervisionSection(props: {
  id?: string;
  title: string;
  description?: string;
  badge?: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={props.id}
      className={cn(
        "scroll-mt-24 rounded-2xl border border-black/[0.06] bg-white/90 p-4 shadow-sm dark:bg-card",
        props.accent && "border-amber-200/50 dark:border-amber-900/30",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{props.title}</h3>
          {props.description ? <p className="mt-0.5 text-xs text-muted-foreground">{props.description}</p> : null}
        </div>
        {props.badge ? (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {props.badge}
          </span>
        ) : null}
      </div>
      {props.children}
    </div>
  );
}
