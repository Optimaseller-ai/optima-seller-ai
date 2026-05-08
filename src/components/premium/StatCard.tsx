"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "pro";
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border border-black/5 bg-white/70 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur",
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] motion-reduce:hover:translate-y-0",
        tone === "pro" ? "ring-1 ring-[rgba(245,158,11,0.22)]" : null,
      )}
    >
      <CardContent className="p-5">
        <div className="pointer-events-none absolute inset-0 opacity-80 [mask-image:radial-gradient(55%_120%_at_70%_0%,black,transparent)]">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[rgba(22,163,74,0.10)] blur-3xl" />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="text-xs font-medium text-[var(--brand-navy)]/55">{title}</div>
            <div className="text-2xl font-semibold tracking-tight text-[var(--brand-navy)]">{value}</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/5 bg-[hsl(var(--background))] shadow-sm">
            <Icon className={cn("size-5", tone === "pro" ? "text-[var(--brand-gold)]" : "text-[var(--brand-green)]")} />
          </div>
        </div>
        {subtitle ? <div className="mt-3 text-xs text-[var(--brand-navy)]/55">{subtitle}</div> : null}
      </CardContent>
    </Card>
  );
}
