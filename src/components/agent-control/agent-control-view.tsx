"use client";

import type { AgentControlSnapshot } from "@/lib/agent-control-panel/snapshot-types";

import { ActivityTimelineSection } from "./activity-timeline-section";
import { formatDateTime } from "./display-utils";
import { LiveAgentStatusBar } from "./live-agent-status";
import { ProspectDashboardSection } from "./prospect-dashboard-section";
import { SalesInsightSection } from "./sales-insight-section";

export function AgentControlView(props: { snapshot: AgentControlSnapshot }) {
  const s = props.snapshot;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Optima Seller AI</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Panneau de supervision agent</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Visualisation du pipeline commercial et des décisions — données fournies par le backend, sans calcul métier côté
          interface.
        </p>
      </header>

      <LiveAgentStatusBar
        status={s.agent.status}
        detail={s.agent.label}
        updatedAt={formatDateTime(s.updatedAt)}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-6">
          <ProspectDashboardSection prospect={s.prospect} />
          <ActivityTimelineSection entries={s.timeline} />
        </div>
        <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <SalesInsightSection insight={s.salesInsight} />
        </div>
      </div>
    </div>
  );
}
