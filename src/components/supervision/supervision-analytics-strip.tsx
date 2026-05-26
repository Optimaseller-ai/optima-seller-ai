"use client";

import type { SupervisionAnalytics } from "@/lib/supervision/supervision-types";

export function SupervisionAnalyticsStrip(props: { analytics: SupervisionAnalytics }) {
  const a = props.analytics;
  const items = [
    { label: "Taux réponse", value: `${a.responseRatePct}%` },
    { label: "Prospects chauds", value: String(a.hotProspects) },
    { label: "Conversions", value: String(a.conversionsApprox) },
    { label: "Relances", value: String(a.followupsSent) },
    { label: "Actions validées", value: String(a.actionsValidated) },
    { label: "Workflows actifs", value: String(a.activeWorkflows) },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-black/[0.06] bg-white/90 px-3 py-3 shadow-sm dark:bg-card"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
