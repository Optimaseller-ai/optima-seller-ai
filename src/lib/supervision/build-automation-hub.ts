import "server-only";

import type { AutomationActionJob } from "@/lib/automation/action-queue";
import { listAllAutomationJobs, peekAwaitingHumanJobs } from "@/lib/automation/action-queue";
import { serializeAutomationPendingItem, supervisionActionKindUi } from "@/lib/automation/supervision-serialize";
import type { AutomationPendingItemDTO } from "@/lib/automation/supervision-dto-types";

import { mapN8nRunStatusToDelivery } from "@/lib/automation/automation-delivery-status";
import { getRecentBlockedForSupervision } from "@/lib/automation/rate-limit/automation-history";
import { getWorkflowRunStats, listWorkflowRuns } from "@/lib/n8n/workflows/workflow-status-tracker";

import type {
  SupervisionAutomationHub,
  SupervisionAutomationPulse,
  SupervisionAutomationStory,
  SupervisionAutomationTimelineItem,
  SupervisionN8nRunItem,
} from "./supervision-types";

function prospectLabel(job: AutomationActionJob): string {
  return job.ctx.prospectLead?.name?.trim() || "Un prospect";
}

function humanActionLabel(job: AutomationActionJob): string {
  const ui = supervisionActionKindUi(job);
  const name = prospectLabel(job);
  if (job.status === "awaiting_human") {
    if (ui === "email") return `${name} — email à valider`;
    if (ui === "whatsapp") return `${name} — relance WhatsApp à valider`;
    return `${name} — action à valider`;
  }
  if (job.status === "scheduled" && job.scheduledFor) {
    return `Relance prévue pour ${name}`;
  }
  if (job.status === "executing" || job.status === "processing") {
    if (ui === "email") return `Envoi email en cours — ${name}`;
    if (ui === "whatsapp") return `Message WhatsApp en cours — ${name}`;
    return `Workflow en cours — ${name}`;
  }
  if (job.intent?.rationale) return job.intent.rationale.slice(0, 120);
  return `Suivi commercial — ${name}`;
}

function storyStatus(
  job: AutomationActionJob,
): SupervisionAutomationStory["status"] {
  if (job.status === "awaiting_human") return "needs_you";
  if (job.status === "scheduled") return "scheduled";
  if (job.status === "executing" || job.status === "processing" || job.status === "retrying") return "running";
  if (job.status === "completed" || job.status === "auto_executed" || job.status === "soft_executed") return "done";
  return "queued";
}

function toStory(job: AutomationActionJob): SupervisionAutomationStory {
  const ui = supervisionActionKindUi(job);
  return {
    id: job.id,
    at: job.scheduledFor ?? job.createdAt,
    label: humanActionLabel(job),
    preview: (job.ctx.lastUserMessage ?? job.intent?.rationale ?? "").slice(0, 160),
    prospectName: prospectLabel(job),
    status: storyStatus(job),
    conversationId: job.ctx.conversationId ?? undefined,
    kind: ui === "email" ? "email" : ui === "whatsapp" ? "whatsapp" : "workflow",
  };
}

function timelineFromJob(job: AutomationActionJob): SupervisionAutomationTimelineItem {
  const ui = supervisionActionKindUi(job);
  let kind: SupervisionAutomationTimelineItem["kind"] = "ai_action";
  let label = humanActionLabel(job);

  if (job.status === "awaiting_human") {
    kind = "validation";
    label = `Validation demandée — ${prospectLabel(job)}`;
  } else if (job.status === "scheduled") {
    kind = "followup";
    label = `Relance programmée — ${prospectLabel(job)}`;
  } else if (ui === "n8n_workflow" || job.event.includes("n8n") || job.event.includes("workflow")) {
    kind = "workflow";
    label = `Workflow lancé — ${prospectLabel(job)}`;
  }

  return {
    id: `tl_${job.id}`,
    at: job.scheduledFor ?? job.createdAt,
    kind,
    label,
    preview: job.intent?.rationale?.slice(0, 100),
  };
}

export function buildAutomationHub(
  depth: {
    awaitingHuman: number;
    pending: number;
    executing: number;
    scheduled: number;
    retrying: number;
    blocked: number;
  },
): SupervisionAutomationHub {
  const all = [...listAllAutomationJobs()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const validations: AutomationPendingItemDTO[] = peekAwaitingHumanJobs(12).map(serializeAutomationPendingItem);

  const followups = all
    .filter((j) => j.status === "scheduled" || (j.scheduledFor && j.status !== "cancelled"))
    .slice(0, 8)
    .map(toStory);

  const workflows = all
    .filter((j) => {
      const ui = supervisionActionKindUi(j);
      return ui === "n8n_workflow" || j.status === "executing" || j.status === "processing";
    })
    .slice(0, 8)
    .map(toStory);

  const aiActions = all
    .filter((j) =>
      ["pending", "executing", "processing", "retrying", "auto_executed", "completed"].includes(j.status),
    )
    .slice(0, 10)
    .map(toStory);

  const timeline = all.slice(0, 14).map(timelineFromJob);

  const inProgress = depth.executing + depth.retrying;
  const pulse: SupervisionAutomationPulse = {
    headline:
      depth.awaitingHuman > 0
        ? `Votre équipe attend ${depth.awaitingHuman} décision${depth.awaitingHuman > 1 ? "s" : ""}`
        : inProgress > 0
          ? "L’équipe traite des actions en ce moment"
          : depth.scheduled > 0
            ? `${depth.scheduled} relance${depth.scheduled > 1 ? "s" : ""} planifiée${depth.scheduled > 1 ? "s" : ""}`
            : "Tout est calme — l’équipe surveille les conversations",
    subline:
      depth.awaitingHuman > 0
        ? "Validez ou refusez en un clic — rien ne part sans vous si c’est sensible."
        : "Relances, emails et workflows tournent en arrière-plan.",
    awaitingYou: depth.awaitingHuman,
    inProgress,
    scheduled: depth.scheduled,
    queued: depth.pending,
  };

  const automationAlerts: SupervisionAutomationHub["automationAlerts"] = [];
  if (depth.awaitingHuman > 0) {
    automationAlerts.push({
      id: "alert_validation",
      tone: "attention",
      message: `${depth.awaitingHuman} action${depth.awaitingHuman > 1 ? "s" : ""} attendent votre OK.`,
    });
  }
  if (depth.blocked > 0) {
    automationAlerts.push({
      id: "alert_blocked",
      tone: "muted",
      message: "Certaines actions sont en pause (sécurité ou horaires).",
    });
  }
  if (inProgress > 2) {
    automationAlerts.push({
      id: "alert_busy",
      tone: "info",
      message: "Plusieurs tâches en cours — tout se déroule normalement.",
    });
  }

  const n8nStats = getWorkflowRunStats();
  const n8nRuns: SupervisionN8nRunItem[] = listWorkflowRuns({ limit: 12 }).map((r) => {
    const deliveryStatus = mapN8nRunStatusToDelivery(r.status);
    const resultLabel =
      r.status === "success"
        ? "n8n OK"
        : r.status === "failed"
          ? "Échec"
          : r.status === "retrying"
            ? "Nouvel essai"
            : r.status === "running"
              ? "En cours"
              : r.status;
    return {
      runId: r.runId,
      jobId: r.jobId,
      workflowSlug: r.workflowSlug,
      workflowKind: r.workflowKind,
      status: r.status,
      deliveryStatus,
      label: `${r.workflowSlug.replace(/-/g, " ")}`,
      at: r.updatedAt,
      attempts: r.attempts,
      lastError: r.lastError,
      sessionId: r.sessionId,
      agentId: r.agentId,
      agentName: typeof r.metadata?.agentName === "string" ? r.metadata.agentName : undefined,
      resultLabel,
    };
  });

  if (n8nStats.failed > 0) {
    automationAlerts.push({
      id: "alert_n8n_failed",
      tone: "attention",
      message: `${n8nStats.failed} workflow${n8nStats.failed > 1 ? "s" : ""} n8n en échec — vérifiez les logs.`,
    });
  }
  if (n8nStats.retrying > 0) {
    automationAlerts.push({
      id: "alert_n8n_retry",
      tone: "info",
      message: `${n8nStats.retrying} relance${n8nStats.retrying > 1 ? "s" : ""} n8n en cours.`,
    });
  }

  const rateLimitInsights = getRecentBlockedForSupervision(10).map((b) => {
    const until = b.cooldownUntil
      ? new Date(b.cooldownUntil).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined;
    return {
      conversationId: b.conversationId,
      sessionId: b.sessionId,
      humanLabel: until
        ? `Action bloquée anti-spam — cooldown jusqu'à ${until}`
        : "Action bloquée pour éviter le spam",
      cooldownUntil: b.cooldownUntil,
      blockedReason: b.reason,
    };
  });

  return {
    pulse,
    aiActions,
    validations,
    followups,
    workflows,
    timeline,
    automationAlerts,
    n8nRuns,
    n8nStats,
    rateLimitInsights,
  };
}
