/**
 * Journal structuré des événements automation (observabilité).
 */

import type { AutomationEventName, AutomationTriggerKind } from "./types";

export type AutomationLogLevel = "info" | "warn" | "error";

export type AutomationLogEntry = {
  ts: string;
  level: AutomationLogLevel;
  event?: AutomationEventName;
  trigger?: AutomationTriggerKind;
  agentId?: string;
  sessionId?: string;
  message: string;
  meta?: Record<string, unknown>;
};

const buffer: AutomationLogEntry[] = [];
const MAX_BUFFER = 500;

export function logAutomation(entry: Omit<AutomationLogEntry, "ts">) {
  const row: AutomationLogEntry = { ...entry, ts: new Date().toISOString() };
  buffer.push(row);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  const tag = "[OPTIMA_AUTOMATION]";
  const payload = {
    event: row.event,
    trigger: row.trigger,
    agentId: row.agentId,
    sessionId: row.sessionId?.slice(0, 8),
    ...row.meta,
  };

  if (row.level === "error") console.error(tag, row.message, payload);
  else if (row.level === "warn") console.warn(tag, row.message, payload);
  else console.log(tag, row.message, payload);
}

export function getAutomationLogSnapshot(limit = 50): AutomationLogEntry[] {
  return buffer.slice(-limit);
}
