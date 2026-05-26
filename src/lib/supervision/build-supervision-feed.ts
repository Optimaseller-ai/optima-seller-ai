import "server-only";

import {
  getAutomationActionQueueDepth,
  listAllAutomationJobs,
  peekAwaitingHumanJobs,
} from "@/lib/automation/action-queue";
import { serializeAutomationPendingItem } from "@/lib/automation/supervision-serialize";
import type { SellerBehaviorConversationState } from "@/lib/agents/memory/conversation-state";
import { createAdminClient } from "@/lib/supabase/admin";

import { buildAutomationHub } from "./build-automation-hub";
import { buildSupervisionHistoryInsights } from "@/lib/automation/rate-limit/automation-history";
import { readTakeoverMode } from "./conversation-takeover";
import { detectSupervisionAlerts } from "./smart-alert-engine";
import { getSupervisionBusSnapshot } from "./supervision-event-bus";
import type {
  HotProspectItem,
  ProspectIntelligenceSnapshot,
  SupervisionAgentStatus,
  SupervisionAnalytics,
  SupervisionControlCenterPayload,
  SupervisionConversationDetail,
  SupervisionDecisionExplanation,
  SupervisionFeedItem,
  SupervisionTimelineEntry,
} from "./supervision-types";

type ConvRow = {
  id: string;
  agent_id: string;
  session_id: string;
  status: string;
  relance_count: number | null;
  last_message_at: string | null;
  last_user_message_at: string | null;
  last_ai_message_at: string | null;
  last_message_preview: string | null;
  conversation_state: unknown;
  updated_at: string;
};

function prospectName(state: SellerBehaviorConversationState | undefined): string {
  return (
    state?.prospectLead?.name?.trim() ||
    state?.prospectProfile?.displayName?.trim() ||
    "Prospect"
  );
}

function temperatureFromState(
  state: SellerBehaviorConversationState | undefined,
): "cold" | "warm" | "hot" | "ready" {
  const t = state?.liveOrchestrator?.prospectTemperature;
  if (t === "ready" || t === "hot" || t === "warm") return t;
  const intent = state?.conversationProfile?.buyingIntent ?? 0;
  if (intent >= 75) return "ready";
  if (intent >= 55) return "hot";
  if (intent >= 35) return "warm";
  return "cold";
}

function salesScoreFromState(state: SellerBehaviorConversationState | undefined): number {
  const live = state?.liveOrchestrator?.confidenceScore;
  if (typeof live === "number") return Math.round(live * 100);
  return Math.min(100, state?.conversationProfile?.buyingIntent ?? 25);
}

function urgencyLabel(temp: "cold" | "warm" | "hot" | "ready", status: string): string {
  if (status === "awaiting_payment") return "⏳ attend validation paiement";
  if (temp === "ready") return "🟢 prêt commande";
  if (temp === "hot") return "🔥 prospect très intéressé";
  if (temp === "warm") return "🟡 en cours";
  return "⚪ froid";
}

function buildProspectIntel(
  state: SellerBehaviorConversationState | undefined,
): ProspectIntelligenceSnapshot {
  const temp = temperatureFromState(state);
  return {
    mood: state?.mood ?? state?.liveOrchestrator?.emotionalState,
    objections: state?.commercialMemory?.objections ?? state?.salesSignalsMemory?.objectionKinds ?? [],
    trustLevel01: state?.salesSignalsMemory?.trustLevel01,
    likedProducts: [
      ...(state?.commercialMemory?.likedProducts ?? []),
      ...(state?.productMemory?.viewedProducts ?? []).slice(0, 3),
    ].filter(Boolean),
    interactionSummary:
      state?.commercialMemory?.preferences?.join(", ") ||
      state?.conversationProfile?.lastTopics?.slice(-2).join(" · ") ||
      "—",
    loyaltyScore: Math.round((state?.salesSignalsMemory?.trustLevel01 ?? 0.5) * 100),
    activeHourHint:
      typeof state?.salesSignalsMemory?.activeLocalHour === "number"
        ? `Actif vers ${state.salesSignalsMemory.activeLocalHour}h`
        : undefined,
    temperature: temp,
  };
}

function buildDecisions(
  state: SellerBehaviorConversationState | undefined,
): SupervisionDecisionExplanation[] {
  const live = state?.liveOrchestrator;
  const out: SupervisionDecisionExplanation[] = [];
  if (live?.nextFollowupAt) {
    out.push({
      headline: "Relance programmée",
      reasons: [
        live.prospectTemperature === "hot" || live.prospectTemperature === "ready"
          ? "Prospect chaud détecté."
          : "Silence ou étape follow-up dans le pipeline.",
        live.lastWorkflowTrigger ? `Workflow : ${live.lastWorkflowTrigger}` : "File automation interne.",
      ],
    });
  }
  if (live?.lastAgentAction === "request_admin_approval") {
    out.push({
      headline: "Validation humaine demandée",
      reasons: ["Action sensible (remise, email, commande) — file awaiting_human."],
    });
  }
  if (live?.lastAgentAction === "hold_silence") {
    out.push({
      headline: "Réponse différée",
      reasons: ["Heures silencieuses ou rythme humain — pas d’envoi immédiat."],
    });
  }
  return out.slice(0, 4);
}

function buildTimelineFromState(
  state: SellerBehaviorConversationState | undefined,
  conv: ConvRow,
): SupervisionTimelineEntry[] {
  const entries: SupervisionTimelineEntry[] = [];
  const preview = conv.last_message_preview?.trim();
  if (preview) {
    entries.push({
      id: `msg_${conv.id}`,
      at: conv.last_message_at ?? conv.updated_at,
      kind: "message",
      label: "Dernier message",
      detail: preview,
    });
  }
  if ((conv.relance_count ?? 0) > 0) {
    entries.push({
      id: `fu_${conv.id}`,
      at: conv.last_ai_message_at ?? conv.updated_at,
      kind: "followup_sent",
      label: "Relance IA",
      detail: `Relance #${conv.relance_count}`,
    });
  }
  const wf = state?.liveOrchestrator?.lastWorkflowTrigger;
  if (wf) {
    entries.push({
      id: `wf_${conv.id}`,
      at: conv.updated_at,
      kind: "workflow_n8n",
      label: "Workflow n8n",
      detail: wf,
    });
  }
  if (state?.automation?.lastTrigger) {
    entries.push({
      id: `auto_${conv.id}`,
      at: new Date(state.automation.lastProcessedAt ?? Date.now()).toISOString(),
      kind: "agent_action",
      label: "Action automation",
      detail: state.automation.lastTrigger,
    });
  }
  return entries;
}

function feedFromConversations(rows: ConvRow[], agentNames: Map<string, string>): SupervisionFeedItem[] {
  return rows.slice(0, 30).map((c) => {
    const state = (c.conversation_state ?? {}) as SellerBehaviorConversationState;
    const temp = temperatureFromState(state);
    const isUserLast =
      c.last_user_message_at &&
      (!c.last_ai_message_at ||
        new Date(c.last_user_message_at).getTime() > new Date(c.last_ai_message_at).getTime());

    return {
      id: `conv_${c.id}_${c.updated_at}`,
      at: c.last_message_at ?? c.updated_at,
      kind: isUserLast ? "user_message" : "ai_reply",
      title: isUserLast ? "Message prospect" : "Réponse agent",
      preview: c.last_message_preview?.trim() || "—",
      conversationId: c.id,
      sessionId: c.session_id,
      agentId: c.agent_id,
      agentName: agentNames.get(c.agent_id),
      temperature: temp,
    };
  });
}

function feedFromAutomationJobs(limit: number): SupervisionFeedItem[] {
  const jobs = listAllAutomationJobs()
    .filter((j) => j.status === "awaiting_human" || j.status === "executing" || j.status === "scheduled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  return jobs.map((j) => ({
    id: `job_${j.id}`,
    at: j.createdAt,
    kind: j.status === "awaiting_human" ? "approval_requested" : j.status === "scheduled" ? "followup" : "workflow",
    title:
      j.status === "awaiting_human"
        ? "Validation requise"
        : j.status === "scheduled"
          ? "Relance programmée"
          : "Workflow en cours",
    preview: (j.ctx.lastUserMessage ?? j.intent?.rationale ?? j.event).slice(0, 200),
    conversationId: j.ctx.conversationId ?? undefined,
    sessionId: j.ctx.sessionId,
    agentId: j.ctx.agentId,
    temperature:
      j.priorityBand === "hot" ? "hot" : j.priorityBand === "warm" ? "warm" : "cold",
  }));
}

export async function buildSupervisionControlCenter(
  userId: string | null,
): Promise<SupervisionControlCenterPayload> {
  const bus = getSupervisionBusSnapshot();
  const depth = getAutomationActionQueueDepth();
  const pendingApprovals = peekAwaitingHumanJobs(25).map(serializeAutomationPendingItem);

  let rows: ConvRow[] = [];
  const agentNames = new Map<string, string>();

  if (userId) {
    const admin = createAdminClient();
    const { data: agents } = await admin.from("agents").select("id,name").eq("user_id", userId);
    const agentList = agents ?? [];
    for (const a of agentList) agentNames.set(a.id, a.name ?? "Agent");

    const ids = agentList.map((a) => a.id);
    if (ids.length) {
      const { data: convs } = await admin
        .from("conversations")
        .select(
          "id,agent_id,session_id,status,relance_count,last_message_at,last_user_message_at,last_ai_message_at,last_message_preview,conversation_state,updated_at",
        )
        .in("agent_id", ids)
        .order("updated_at", { ascending: false })
        .limit(60);

      rows = (convs ?? []) as ConvRow[];
    }
  }

  const feed: SupervisionFeedItem[] = [
    ...bus.feed,
    ...feedFromAutomationJobs(12),
    ...feedFromConversations(rows, agentNames),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  const hotProspects: HotProspectItem[] = rows
    .map((c) => {
      const state = (c.conversation_state ?? {}) as SellerBehaviorConversationState;
      const temp = temperatureFromState(state);
      const score = salesScoreFromState(state);
      if (temp !== "hot" && temp !== "ready" && score < 60) return null;
      return {
        conversationId: c.id,
        sessionId: c.session_id,
        agentId: c.agent_id,
        name: prospectName(state),
        salesScore: score,
        status: temp,
        urgencyLabel: urgencyLabel(temp, c.status),
        lastProduct:
          state.productMemory?.lastProductFocus ??
          state.productMemory?.lastMentionedInterest ??
          state.conversationProfile?.preferredProducts?.[0],
        lastAiAction: state.liveOrchestrator?.lastAgentAction ?? state.automation?.lastTrigger,
        lastActivityAt: c.last_message_at ?? c.updated_at,
      } satisfies HotProspectItem;
    })
    .filter(Boolean) as HotProspectItem[];

  hotProspects.sort((a, b) => b.salesScore - a.salesScore);

  const alerts = [
    ...bus.alerts,
    ...rows.flatMap((c) => {
      const state = (c.conversation_state ?? {}) as SellerBehaviorConversationState;
      return detectSupervisionAlerts({
        conversationId: c.id,
        conversationState: state,
        status: c.status,
        relanceCount: c.relance_count ?? 0,
        lastUserAt: c.last_user_message_at,
        lastAiAt: c.last_ai_message_at,
      });
    }),
  ].slice(0, 12);

  const activeCount = rows.filter((r) => r.status !== "closed_won" && r.status !== "closed_lost").length;
  const relanced = rows.filter((r) => (r.relance_count ?? 0) > 0);
  const repliedAfter = relanced.filter((r) => {
    if (!r.last_user_message_at || !r.last_ai_message_at) return false;
    return new Date(r.last_user_message_at).getTime() > new Date(r.last_ai_message_at).getTime();
  });

  const analytics: SupervisionAnalytics = {
    responseRatePct: relanced.length ? Math.round((repliedAfter.length / relanced.length) * 100) : 0,
    hotProspects: hotProspects.length,
    conversionsApprox: rows.filter((r) => r.status === "closed_won").length,
    followupsSent: rows.reduce((n, r) => n + (r.relance_count ?? 0), 0),
    actionsValidated: depth.completed + depth.autoExecuted,
    activeWorkflows: depth.executing + depth.scheduled + depth.pending,
  };

  const humanWaiting = rows.some((c) => {
    const mode = readTakeoverMode(c.conversation_state);
    return mode === "HUMAN_ACTIVE";
  });

  const agent: SupervisionAgentStatus = {
    status:
      depth.awaitingHuman > 0
        ? "waiting_approval"
        : depth.executing > 0
          ? "executing_action"
          : activeCount > 3
            ? "processing"
            : "active",
    label:
      depth.awaitingHuman > 0
        ? `${depth.awaitingHuman} validation(s) en attente`
        : `${activeCount} conversation(s) suivie(s)`,
    typing: depth.executing > 0,
    paused: humanWaiting,
    followupMode: depth.scheduled > 0,
    loadLabel: activeCount <= 2 ? "Légère" : activeCount <= 8 ? "Modérée" : "Élevée",
    activeConversations: activeCount,
  };

  const automation = buildAutomationHub(depth);
  const prospectNames = new Map<string, string>();
  for (const j of listAllAutomationJobs()) {
    const name = j.ctx.prospectLead?.name?.trim();
    if (name) prospectNames.set(j.ctx.sessionId, name);
  }
  const historyInsights = await buildSupervisionHistoryInsights(
    [...prospectNames.keys()],
    prospectNames,
  );
  const mergedInsights = [...automation.rateLimitInsights, ...historyInsights].slice(0, 12);

  return {
    updatedAt: new Date().toISOString(),
    analytics,
    alerts,
    feed,
    hotProspects: hotProspects.slice(0, 8),
    agent,
    pendingApprovals: automation.validations,
    queueDepth: {
      awaitingHuman: depth.awaitingHuman,
      pending: depth.pending,
      executing: depth.executing,
      scheduled: depth.scheduled,
    },
    automation: { ...automation, rateLimitInsights: mergedInsights },
  };
}

export async function buildSupervisionConversationDetail(
  userId: string | null,
  conversationId: string,
): Promise<SupervisionConversationDetail | null> {
  if (!userId) return null;

  const admin = createAdminClient();
  const { data: conv } = await admin
    .from("conversations")
    .select(
      "id,agent_id,session_id,status,relance_count,last_message_at,last_message_preview,conversation_state,updated_at",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) return null;

  const { data: agentRow } = await admin
    .from("agents")
    .select("name,user_id")
    .eq("id", conv.agent_id)
    .maybeSingle();

  if (agentRow?.user_id && agentRow.user_id !== userId) return null;

  const state = ((conv as ConvRow).conversation_state ?? {}) as SellerBehaviorConversationState;
  const live = state.liveOrchestrator;

  return {
    conversationId: conv.id,
    sessionId: conv.session_id,
    agentId: conv.agent_id,
    agentName: agentRow?.name ?? "Agent",
    status: conv.status,
    takeoverMode: readTakeoverMode(state),
    lastPreview: (conv as ConvRow).last_message_preview ?? undefined,
    updatedAt: conv.updated_at,
    orchestrator: live
      ? {
          currentGoal: live.currentGoal,
          conversationStage: live.conversationStage,
          prospectTemperature: live.prospectTemperature,
          emotionalState: live.emotionalState,
          urgencyLevel: live.urgencyLevel,
          nextPlannedAction: live.lastAgentAction ?? "reply_now",
          nextPlannedActionReason: live.pendingActions?.[0]?.reason ?? "",
          scheduledFollowupAt: live.nextFollowupAt,
          workflowTriggered: live.lastWorkflowTrigger,
          confidenceScore: live.confidenceScore,
          priorityMode: live.priorityMode,
        }
      : undefined,
    prospect: buildProspectIntel(state),
    timeline: buildTimelineFromState(state, conv as ConvRow),
    decisions: buildDecisions(state),
    pipelineDebug: state.pipelineRuntime,
  };
}
