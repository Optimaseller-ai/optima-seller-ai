/**
 * Machine à états — transitions strictes et traçables.
 */

import type {
  AutomationExecutionRecord,
  AutomationExecutionState,
} from "./execution-types";

const ALLOWED: Record<AutomationExecutionState, AutomationExecutionState[]> = {
  detected: ["approved", "failed", "cancelled"],
  approved: ["queued", "failed", "cancelled"],
  queued: ["processing", "failed", "cancelled"],
  processing: ["executed", "failed", "retrying", "cancelled"],
  retrying: ["processing", "failed", "cancelled"],
  executed: [],
  failed: [],
  cancelled: [],
};

export function createAutomationExecutionRecord(args: {
  executionId: string;
  intentActionType: string;
}): AutomationExecutionRecord {
  const at = new Date().toISOString();
  return {
    executionId: args.executionId,
    intentActionType: args.intentActionType,
    state: "detected",
    transitions: [{ at, from: null, to: "detected", reason: "intent_received" }],
  };
}

export function assertTransitionAllowed(from: AutomationExecutionState, to: AutomationExecutionState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function transitionAutomationExecution(
  record: AutomationExecutionRecord,
  to: AutomationExecutionState,
  reason?: string,
): boolean {
  if (!assertTransitionAllowed(record.state, to)) return false;
  const at = new Date().toISOString();
  record.transitions.push({ at, from: record.state, to, reason });
  record.state = to;
  return true;
}

const executionIndex = new Map<string, AutomationExecutionRecord>();

export function registerAutomationExecution(record: AutomationExecutionRecord) {
  executionIndex.set(record.executionId, record);
}

export function getAutomationExecutionRecord(id: string): AutomationExecutionRecord | undefined {
  return executionIndex.get(id);
}

export function snapshotRecentAutomationExecutions(limit = 40): AutomationExecutionRecord[] {
  return [...executionIndex.values()].slice(-limit);
}
