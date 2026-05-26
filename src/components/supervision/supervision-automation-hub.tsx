"use client";

import type { SupervisionAutomationHub } from "@/lib/supervision/supervision-types";

import { AutomationCompactList } from "./automation-compact-list";
import { AutomationQueuePulse } from "./automation-queue-pulse";
import { AutomationTimelineStrip } from "./automation-timeline-strip";
import { AutomationValidationsSection } from "./automation-validations-section";
import { SupervisionSection } from "./supervision-section";

export function SupervisionAutomationHub(props: {
  hub: SupervisionAutomationHub;
  onRefresh?: () => void;
  onSelectConversation?: (id: string) => void;
}) {
  const h = props.hub;

  return (
    <section id="equipe" className="space-y-5 scroll-mt-24">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Votre équipe en action</h2>
        <p className="text-sm text-muted-foreground">
          Relances, validations et workflows — comme si vous supervisiez de vrais commerciaux.
        </p>
      </div>

      <AutomationQueuePulse pulse={h.pulse} alerts={h.automationAlerts} />

      {h.rateLimitInsights.length > 0 ? (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
            Anti-spam automation
          </p>
          <ul className="mt-2 space-y-1.5">
            {h.rateLimitInsights.map((insight) => (
              <li key={`${insight.conversationId}-${insight.humanLabel}`} className="text-muted-foreground">
                {insight.prospectName ? `${insight.prospectName} — ` : ""}
                {insight.humanLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {h.timeline.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fil d’activité récent</p>
          <AutomationTimelineStrip items={h.timeline} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SupervisionSection
          id="validations"
          title="Validations"
          description="Actions qui attendent votre accord avant envoi."
          badge={h.validations.length > 0 ? String(h.validations.length) : undefined}
          accent={h.validations.length > 0}
        >
          <AutomationValidationsSection items={h.validations} onRefresh={props.onRefresh} />
        </SupervisionSection>

        <SupervisionSection
          id="actions-ia"
          title="Actions IA"
          description="Ce que l’équipe traite en ce moment."
        >
          <AutomationCompactList
            items={h.aiActions}
            emptyMessage="Aucune action en cours — l’équipe écoute les conversations."
            onSelectConversation={props.onSelectConversation}
          />
        </SupervisionSection>

        <SupervisionSection
          id="relances"
          title="Relances"
          description="Messages programmés pour plus tard."
          badge={h.followups.length > 0 ? String(h.followups.length) : undefined}
        >
          <AutomationCompactList
            items={h.followups}
            emptyMessage="Pas de relance planifiée pour l’instant."
            onSelectConversation={props.onSelectConversation}
          />
        </SupervisionSection>

        <SupervisionSection
          id="workflows"
          title="Workflows récents"
          description="Intégrations et automatisations lancées."
        >
          <AutomationCompactList
            items={h.workflows}
            emptyMessage="Aucun workflow récent."
            onSelectConversation={props.onSelectConversation}
          />
        </SupervisionSection>

        <SupervisionSection
          id="n8n-live"
          title="Exécutions n8n"
          description="Workflows actifs, retries et succès en direct."
          badge={
            h.n8nStats.running + h.n8nStats.retrying > 0
              ? String(h.n8nStats.running + h.n8nStats.retrying)
              : undefined
          }
        >
          {h.n8nRuns.length > 0 ? (
            <ul className="space-y-2">
              {h.n8nRuns.map((r) => (
                <li
                  key={r.runId}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.workflowKind}
                      {r.agentName ? ` · ${r.agentName}` : r.agentId ? ` · agent ${r.agentId.slice(0, 8)}` : ""}
                      {" · "}
                      {new Date(r.at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {r.attempts} essai{r.attempts > 1 ? "s" : ""}
                      {r.resultLabel ? ` · ${r.resultLabel}` : ""}
                      {r.lastError ? ` · ${r.lastError.slice(0, 40)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {r.deliveryStatus ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune exécution n8n récente.</p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {h.n8nStats.success} réussite{h.n8nStats.success !== 1 ? "s" : ""} · {h.n8nStats.failed} échec
            {h.n8nStats.failed !== 1 ? "s" : ""} · {h.n8nStats.queued} en file
          </p>
        </SupervisionSection>
      </div>
    </section>
  );
}
