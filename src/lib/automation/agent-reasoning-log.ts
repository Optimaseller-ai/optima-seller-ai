/**
 * Journal raisonnement interne — jamais exposé au prospect (analytics / debug / futur training).
 */

import "server-only";

export type AgentReasoningEntry = {
  ts: string;
  agentId?: string;
  sessionId?: string;
  executionId?: string;
  prospectHesitation?: boolean;
  interestScore?: number;
  actionChosen?: string;
  followupReason?: string;
  commercialStrategy?: string;
  risksDetected?: string[];
  notes?: Record<string, unknown>;
};

const buf: AgentReasoningEntry[] = [];
const MAX = 2500;

export function appendAgentReasoningLog(entry: Omit<AgentReasoningEntry, "ts"> & { ts?: string }) {
  const row: AgentReasoningEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    ...entry,
  };
  buf.push(row);
  if (buf.length > MAX) buf.splice(0, buf.length - MAX);
}

export function getAgentReasoningLogs(sessionId: string, limit = 80): AgentReasoningEntry[] {
  return buf.filter((x) => x.sessionId === sessionId).slice(-limit);
}

export function getAgentReasoningLogsByExecution(executionId: string): AgentReasoningEntry[] {
  return buf.filter((x) => x.executionId === executionId);
}
