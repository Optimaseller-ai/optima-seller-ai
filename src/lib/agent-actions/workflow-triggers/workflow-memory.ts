import "server-only";

import type { AgentActionKind } from "../context/agent-action-types";
import type { AutomationEventName } from "@/lib/automation/types";

export type WorkflowMemoryEntry = {
  id: string;
  at: string;
  sessionId: string;
  prospectId?: string | null;
  kind: AgentActionKind;
  workflow?: string;
  n8nEvent?: AutomationEventName;
  result: "ok" | "failed" | "skipped" | "pending_approval";
  detail?: string;
  correlationId?: string;
  payloadDigest?: string;
};

const bySession = new Map<string, WorkflowMemoryEntry[]>();
const MAX_PER_SESSION = 120;

let seq = 0;
function nextId() {
  seq += 1;
  return `wfm_${Date.now().toString(36)}_${seq}`;
}

function trimSession(sessionId: string) {
  const rows = bySession.get(sessionId);
  if (!rows || rows.length <= MAX_PER_SESSION) return;
  rows.splice(0, rows.length - MAX_PER_SESSION);
}

/**
 * Mémoire courte par session : quelles actions ont été tentées, quand, résultat.
 * Prêt pour persistance (Supabase) — substituer ce store par une table plus tard.
 */
export function recordWorkflowMemory(entry: Omit<WorkflowMemoryEntry, "id" | "at"> & { id?: string; at?: string }) {
  const row: WorkflowMemoryEntry = {
    id: entry.id ?? nextId(),
    at: entry.at ?? new Date().toISOString(),
    sessionId: entry.sessionId,
    prospectId: entry.prospectId,
    kind: entry.kind,
    workflow: entry.workflow,
    n8nEvent: entry.n8nEvent,
    result: entry.result,
    detail: entry.detail,
    correlationId: entry.correlationId,
    payloadDigest: entry.payloadDigest,
  };
  const list = bySession.get(row.sessionId) ?? [];
  list.push(row);
  bySession.set(row.sessionId, list);
  trimSession(row.sessionId);
  return row;
}

export function getWorkflowMemory(sessionId: string, limit = 40): WorkflowMemoryEntry[] {
  const rows = bySession.get(sessionId) ?? [];
  return rows.slice(-limit);
}

export function lastWorkflowMemoryOfKind(sessionId: string, kind: AgentActionKind): WorkflowMemoryEntry | undefined {
  const rows = bySession.get(sessionId) ?? [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]!.kind === kind) return rows[i];
  }
  return undefined;
}
