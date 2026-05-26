import "server-only";

import type { N8nWorkflowKind, N8nWorkflowRunStatus } from "../events/n8n-event-types";

export type WorkflowRunRecord = {
  runId: string;
  jobId: string;
  workflowKind: N8nWorkflowKind;
  workflowSlug: string;
  status: N8nWorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
  sessionId?: string;
  agentId?: string;
  conversationId?: string | null;
  requiresApproval: boolean;
  partialSteps?: string[];
  completedSteps?: string[];
  metadata?: Record<string, unknown>;
};

const runs = new Map<string, WorkflowRunRecord>();
const MAX_RUNS = 4000;

function newRunId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `n8n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function prune() {
  if (runs.size <= MAX_RUNS) return;
  const sorted = [...runs.values()].sort(
    (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
  );
  const remove = sorted.slice(0, runs.size - MAX_RUNS);
  for (const r of remove) runs.delete(r.runId);
}

export function createWorkflowRun(args: {
  jobId: string;
  workflowKind: N8nWorkflowKind;
  workflowSlug: string;
  status?: N8nWorkflowRunStatus;
  sessionId?: string;
  agentId?: string;
  conversationId?: string | null;
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
}): WorkflowRunRecord {
  const now = new Date().toISOString();
  const run: WorkflowRunRecord = {
    runId: newRunId(),
    jobId: args.jobId,
    workflowKind: args.workflowKind,
    workflowSlug: args.workflowSlug,
    status: args.status ?? "queued",
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    sessionId: args.sessionId,
    agentId: args.agentId,
    conversationId: args.conversationId,
    requiresApproval: args.requiresApproval === true,
    metadata: args.metadata,
  };
  runs.set(run.runId, run);
  prune();
  return run;
}

export function getWorkflowRun(runId: string): WorkflowRunRecord | undefined {
  return runs.get(runId);
}

export function getWorkflowRunByJobId(jobId: string): WorkflowRunRecord | undefined {
  return [...runs.values()].find((r) => r.jobId === jobId);
}

export function transitionWorkflowRun(
  runId: string,
  status: N8nWorkflowRunStatus,
  patch?: Partial<Pick<WorkflowRunRecord, "lastError" | "partialSteps" | "completedSteps" | "metadata">>,
): WorkflowRunRecord | undefined {
  const run = runs.get(runId);
  if (!run) return undefined;
  run.status = status;
  run.updatedAt = new Date().toISOString();
  if (patch?.lastError !== undefined) run.lastError = patch.lastError;
  if (patch?.partialSteps) run.partialSteps = patch.partialSteps;
  if (patch?.completedSteps) run.completedSteps = patch.completedSteps;
  if (patch?.metadata) run.metadata = { ...(run.metadata ?? {}), ...patch.metadata };
  return run;
}

export function incrementWorkflowRunAttempt(runId: string): void {
  const run = runs.get(runId);
  if (!run) return;
  run.attempts += 1;
  run.updatedAt = new Date().toISOString();
}

export function listWorkflowRuns(opts?: {
  limit?: number;
  status?: N8nWorkflowRunStatus[];
}): WorkflowRunRecord[] {
  const limit = opts?.limit ?? 50;
  const statuses = opts?.status;
  return [...runs.values()]
    .filter((r) => !statuses || statuses.includes(r.status))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

export function getWorkflowRunStats(): {
  queued: number;
  running: number;
  success: number;
  failed: number;
  retrying: number;
  awaitingHuman: number;
  partial: number;
} {
  const counts = {
    queued: 0,
    running: 0,
    success: 0,
    failed: 0,
    retrying: 0,
    awaitingHuman: 0,
    partial: 0,
  };
  for (const r of runs.values()) {
    if (r.status === "queued") counts.queued += 1;
    else if (r.status === "running") counts.running += 1;
    else if (r.status === "success") counts.success += 1;
    else if (r.status === "failed") counts.failed += 1;
    else if (r.status === "retrying") counts.retrying += 1;
    else if (r.status === "awaiting_human") counts.awaitingHuman += 1;
    else if (r.status === "partial") counts.partial += 1;
  }
  return counts;
}
