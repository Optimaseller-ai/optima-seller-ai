/**
 * Contrats JSON — centre de contrôle supervision Optima Seller AI.
 */

import type { AgentLiveStatus } from "@/lib/agent-control-panel/snapshot-types";
import type { AutomationPendingItemDTO } from "@/lib/automation/supervision-dto-types";
import type { OrchestratorSupervisionSnapshot } from "@/lib/orchestrator/types";
import type { ConversationTakeoverMode } from "./conversation-takeover";

export type SupervisionFeedKind =
  | "new_conversation"
  | "user_message"
  | "ai_reply"
  | "followup"
  | "agent_action"
  | "workflow"
  | "approval_requested";

export type SupervisionFeedItem = {
  id: string;
  at: string;
  kind: SupervisionFeedKind;
  title: string;
  preview: string;
  conversationId?: string;
  sessionId?: string;
  agentId?: string;
  agentName?: string;
  temperature?: "cold" | "warm" | "hot" | "ready";
};

export type HotProspectItem = {
  conversationId: string;
  sessionId: string;
  agentId: string;
  name: string;
  salesScore: number;
  status: "cold" | "warm" | "hot" | "ready";
  urgencyLabel: string;
  lastProduct?: string;
  lastAiAction?: string;
  lastActivityAt: string;
};

export type SupervisionTimelineEntry = {
  id: string;
  at: string;
  kind:
    | "followup_sent"
    | "email_generated"
    | "workflow_n8n"
    | "approval_requested"
    | "product_recommended"
  | "cart_abandoned"
  | "message"
  | "intent"
  | "agent_action";
  label: string;
  detail?: string;
};

export type SupervisionAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  conversationId?: string;
  at: string;
};

export type SupervisionAnalytics = {
  responseRatePct: number;
  hotProspects: number;
  conversionsApprox: number;
  followupsSent: number;
  actionsValidated: number;
  activeWorkflows: number;
};

export type SupervisionAgentStatus = {
  status: AgentLiveStatus;
  label: string;
  typing: boolean;
  paused: boolean;
  followupMode: boolean;
  loadLabel: string;
  activeConversations: number;
};

export type ProspectIntelligenceSnapshot = {
  mood?: string;
  objections: string[];
  trustLevel01?: number;
  likedProducts: string[];
  interactionSummary: string;
  loyaltyScore: number;
  activeHourHint?: string;
  temperature: "cold" | "warm" | "hot" | "ready";
};

export type SupervisionDecisionExplanation = {
  headline: string;
  reasons: string[];
};

export type SupervisionConversationDetail = {
  conversationId: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  status: string;
  takeoverMode: ConversationTakeoverMode;
  lastPreview?: string;
  updatedAt: string;
  orchestrator?: Partial<OrchestratorSupervisionSnapshot>;
  prospect: ProspectIntelligenceSnapshot;
  timeline: SupervisionTimelineEntry[];
  decisions: SupervisionDecisionExplanation[];
  /** Dernier trace pipeline (conversation_state.pipelineRuntime). */
  pipelineDebug?: import("@/lib/chat/pipeline/pipeline-types").ConversationPipelineRuntimeSnapshot;
};

export type SupervisionAutomationStoryStatus =
  | "needs_you"
  | "scheduled"
  | "running"
  | "queued"
  | "done";

export type SupervisionAutomationStory = {
  id: string;
  at: string;
  label: string;
  preview: string;
  prospectName: string;
  status: SupervisionAutomationStoryStatus;
  conversationId?: string;
  kind: "email" | "whatsapp" | "workflow" | "followup";
};

export type SupervisionAutomationTimelineItem = {
  id: string;
  at: string;
  kind: "ai_action" | "validation" | "followup" | "workflow";
  label: string;
  preview?: string;
};

export type SupervisionAutomationPulse = {
  headline: string;
  subline: string;
  awaitingYou: number;
  inProgress: number;
  scheduled: number;
  queued: number;
};

export type SupervisionAutomationAlert = {
  id: string;
  tone: "attention" | "info" | "muted";
  message: string;
};

/** Hub automation conversationnel — remplace l’UI technique /supervision/automation */
export type SupervisionN8nRunItem = {
  runId: string;
  jobId: string;
  workflowSlug: string;
  workflowKind: string;
  status: "queued" | "running" | "success" | "failed" | "retrying" | "awaiting_human" | "partial";
  /** Statut produit unifié (queued, processing, delivered, …). */
  deliveryStatus?: string;
  label: string;
  at: string;
  attempts: number;
  lastError?: string;
  sessionId?: string;
  agentId?: string;
  agentName?: string;
  resultLabel?: string;
};

export type SupervisionN8nStats = {
  queued: number;
  running: number;
  success: number;
  failed: number;
  retrying: number;
  awaitingHuman: number;
  partial: number;
};

export type SupervisionRateLimitInsight = {
  conversationId: string;
  sessionId?: string;
  prospectName?: string;
  humanLabel: string;
  cooldownUntil?: string;
  blockedReason?: string;
};

export type SupervisionAutomationHub = {
  pulse: SupervisionAutomationPulse;
  aiActions: SupervisionAutomationStory[];
  validations: AutomationPendingItemDTO[];
  followups: SupervisionAutomationStory[];
  workflows: SupervisionAutomationStory[];
  timeline: SupervisionAutomationTimelineItem[];
  automationAlerts: SupervisionAutomationAlert[];
  n8nRuns: SupervisionN8nRunItem[];
  n8nStats: SupervisionN8nStats;
  rateLimitInsights: SupervisionRateLimitInsight[];
};

export type SupervisionControlCenterPayload = {
  updatedAt: string;
  analytics: SupervisionAnalytics;
  alerts: SupervisionAlert[];
  feed: SupervisionFeedItem[];
  hotProspects: HotProspectItem[];
  agent: SupervisionAgentStatus;
  /** @deprecated utiliser automation.validations */
  pendingApprovals: AutomationPendingItemDTO[];
  queueDepth: {
    awaitingHuman: number;
    pending: number;
    executing: number;
    scheduled: number;
  };
  automation: SupervisionAutomationHub;
  selectedConversationId?: string | null;
};
