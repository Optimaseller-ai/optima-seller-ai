/**
 * Types partagés — couche exécution automation (états explicites, pas prompts).
 */

import type { AutomationLang } from "./types";

export type AutomationExecutionState =
  | "detected"
  | "approved"
  | "queued"
  | "processing"
  | "executed"
  | "failed"
  | "cancelled"
  | "retrying";

/** Canaux d’exécution — routing déterministe. */
export type ExecutionChannel = "email" | "whatsapp" | "sms" | "human" | "crm" | "calendar" | "chat";

export type ExecutionTransitionRecord = {
  at: string;
  from: AutomationExecutionState | null;
  to: AutomationExecutionState;
  reason?: string;
};

export type AutomationExecutionRecord = {
  executionId: string;
  state: AutomationExecutionState;
  transitions: ExecutionTransitionRecord[];
  intentActionType: string;
  workflowUsed?: string;
  channel?: ExecutionChannel;
};

export type ExecuteAutomationIntentResult = {
  success: boolean;
  executionId: string;
  state: AutomationExecutionState;
  channel?: ExecutionChannel;
  workflowUsed?: string;
  logs: string[];
  error?: string;
  pendingApprovalId?: string;
  jobId?: string;
  webhookOk?: boolean;
  durationMs?: number;
  /** Court message pour injection côté agent (prospect) — naturel. */
  agentFeedbackHint?: string;
  lang?: AutomationLang;
};
