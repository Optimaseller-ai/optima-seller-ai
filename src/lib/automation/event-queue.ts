/**
 * File d’attente événements — retry-safe, anti-doublon.
 */

import { assertNotDuplicate, buildIdempotencyKey } from "./anti-duplicate";
import { logAutomation } from "./event-log";
import type { AutomationEventName, QueuedAutomationEvent } from "./types";

const queue: QueuedAutomationEvent[] = [];
const MAX_QUEUE = 2000;

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `aq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function enqueueAutomationEvent(args: {
  event: AutomationEventName;
  payload: Record<string, unknown>;
  trigger?: string;
  idempotencyParts?: (string | number | null | undefined)[];
}): QueuedAutomationEvent | null {
  const idempotencyKey = buildIdempotencyKey([
    args.event,
    args.trigger ?? "",
    ...(args.idempotencyParts ?? []),
  ]);

  if (!assertNotDuplicate(idempotencyKey)) {
    logAutomation({
      level: "info",
      event: args.event,
      message: "event_skipped_duplicate",
      meta: { idempotencyKey },
    });
    return null;
  }

  const row: QueuedAutomationEvent = {
    id: newId(),
    idempotencyKey,
    event: args.event,
    trigger: args.trigger as QueuedAutomationEvent["trigger"],
    payload: args.payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };

  queue.push(row);
  if (queue.length > MAX_QUEUE) queue.shift();

  logAutomation({
    level: "info",
    event: args.event,
    message: "event_enqueued",
    agentId: String(args.payload.agentId ?? ""),
    sessionId: String(args.payload.sessionId ?? ""),
    meta: { id: row.id },
  });

  return row;
}

export function peekPendingEvents(limit = 20): QueuedAutomationEvent[] {
  return queue.filter((e) => e.status === "pending").slice(0, limit);
}

export function markEventStatus(id: string, status: QueuedAutomationEvent["status"]) {
  const row = queue.find((e) => e.id === id);
  if (row) row.status = status;
}

export function incrementEventAttempt(id: string) {
  const row = queue.find((e) => e.id === id);
  if (row) row.attempts += 1;
}

export function getQueueDepth(): number {
  return queue.filter((e) => e.status === "pending").length;
}
