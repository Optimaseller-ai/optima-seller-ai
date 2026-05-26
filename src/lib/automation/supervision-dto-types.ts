/**
 * Formes JSON exposées supervision automation — utilisables API + frontend.
 */

import type { AutomationActionType } from "./automation-intent-engine";

export type AutomationSupervisionActionKindUi = "email" | "whatsapp" | "n8n_workflow";

export type AutomationSupervisionProspectBrief = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  primaryNeed?: string | null;
  leadTemperature?: string | null;
  city?: string | null;
};

export type AutomationPendingItemDTO = {
  id: string;
  createdAt: string;
  event: string;
  actionKindUi: AutomationSupervisionActionKindUi;
  intentActionType?: AutomationActionType;
  suggestedWorkflow?: string;
  intentPriority?: "low" | "medium" | "high";
  intentConfidence?: number;
  intentRationale?: string;
  intentRequiresApproval?: boolean;
  routedChannel?: string;
  prospect: AutomationSupervisionProspectBrief;
  previewMessage: string;
  agentId: string;
  sessionId: string;
  /** Score priorité lead 0–100 (automation-priority-engine). */
  priorityScore?: number;
  /** cold | warm | hot */
  priorityBand?: string;
  scheduledFor?: string;
  nextRetryAt?: string;
};

export type AutomationJobLifecycleStatus =
  | "pending"
  | "scheduled"
  | "executing"
  | "processing"
  | "completed"
  | "failed"
  | "retrying"
  | "cancelled"
  | "awaiting_human"
  | "auto_executed"
  | "soft_executed"
  | "blocked";

export type AutomationJobDetailDTO = AutomationPendingItemDTO & {
  lifecycleStatus: AutomationJobLifecycleStatus;
  userId?: string;
  conversationId?: string | null;
  lastUserMessage: string;
  lastAssistantReply?: string;
  pipelineStage?: string;
  lang?: string;
  businessName?: string;
  businessCity?: string;
  logTrail: string[];
};

export type AutomationPendingListDTO = {
  /** Nombre total en file `awaiting_human` (toutes les jobs en mémoire). */
  awaitingHumanTotal: number;
  /** Jobs renvoyées dans `items` (plafonné par `limit`). */
  returnedCount: number;
  queueDepth: {
    pending: number;
    scheduled: number;
    executing: number;
    retrying: number;
    awaitingHuman: number;
    blocked: number;
    autoExecuted: number;
    softExecuted: number;
    completed: number;
    failed: number;
  };
  items: AutomationPendingItemDTO[];
};
