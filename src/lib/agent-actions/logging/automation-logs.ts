import "server-only";

import { logAutomation } from "@/lib/automation/event-log";
import type { AutomationEventName, AutomationTriggerKind } from "@/lib/automation/types";
import type { AgentActionKind } from "../context/agent-action-types";

export type AgentAutomationLogInput = {
  level: "info" | "warn" | "error";
  message: string;
  agentId?: string;
  sessionId?: string;
  action?: AgentActionKind;
  event?: AutomationEventName;
  trigger?: AutomationTriggerKind;
  workflow?: string;
  result?: string;
  retries?: number;
  meta?: Record<string, unknown>;
};

/** Journal Agent Actions — même pipeline que l’automation OPTIMA. */
export function logAgentAutomation(entry: AgentAutomationLogInput) {
  logAutomation({
    level: entry.level,
    message: `[agent_actions] ${entry.message}`,
    agentId: entry.agentId,
    sessionId: entry.sessionId,
    event: entry.event,
    trigger: entry.trigger,
    meta: {
      action: entry.action,
      workflow: entry.workflow,
      result: entry.result,
      retries: entry.retries,
      ...entry.meta,
    },
  });
}
