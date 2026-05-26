/**
 * Observabilité exécution — corrélation executionId, transitions, durées, retries.
 */

import "server-only";

import { logAutomation } from "./event-log";
import type { AutomationExecutionState } from "./execution-types";

export function logExecutionObs(args: {
  executionId: string;
  message: string;
  level?: "info" | "warn" | "error";
  agentId?: string;
  sessionId?: string;
  from?: AutomationExecutionState | null;
  to?: AutomationExecutionState;
  durationMs?: number;
  retries?: number;
  webhookStatus?: number;
  error?: string;
  meta?: Record<string, unknown>;
}) {
  logAutomation({
    level: args.level ?? "info",
    message: `[exec_orchestrator] ${args.message}`,
    agentId: args.agentId,
    sessionId: args.sessionId,
    meta: {
      executionId: args.executionId,
      transition: args.from != null && args.to ? `${args.from}->${args.to}` : args.to,
      durationMs: args.durationMs,
      retries: args.retries,
      webhookStatus: args.webhookStatus,
      error: args.error,
      ...args.meta,
    },
  });
}
