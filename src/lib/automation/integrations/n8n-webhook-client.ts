/**
 * n8n Connector Layer — envoi d’événements vers workflows n8n (retry-safe).
 */

import { createHmac } from "crypto";

import { logAutomation } from "../event-log";
import { incrementEventAttempt, markEventStatus } from "../event-queue";
import {
  buildNormalizedN8nPayloadFromQueuedEvent,
  type N8nStablePayload,
} from "../payloads/n8n-production-payload";
import type { AutomationEventName, ConversationAutomationContext, QueuedAutomationEvent } from "../types";
import { dispatchN8nWebhook } from "./n8n-connection-manager";
import {
  canExecuteAutomationAction,
  inputFromAutomationContext,
  recordAutomationExecution,
  resolveActionChannelFromEvent,
} from "../rate-limit/automation-rate-limiter";

export type N8nWebhookPayload = {
  event: AutomationEventName;
  timestamp: string;
  agentId?: string;
  sessionId?: string;
  conversationId?: string | null;
  trigger?: string;
  pipelineStage?: string;
  leadTemperature?: string;
  data?: Record<string, unknown>;
};

/** Payload SaaS normalisé pour n8n — un seul objet JSON lisible par workflow. */
export type N8nStructuredPayload = {
  event: AutomationEventName;
  timestamp: string;
  prospect: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    leadTemperature?: string;
    primaryNeed?: string;
  };
  conversation: {
    sessionId: string;
    conversationId?: string;
    lastUserMessage?: string;
    pipelineStage?: string;
    lang?: string;
  };
  agent: {
    id: string;
    displayName?: string;
  };
  action: {
    type: string;
    workflow?: string;
    confidence?: number;
    priority?: string;
    requiresApproval?: boolean;
  };
  businessContext: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function getWebhookUrl(): string | null {
  const url = String(process.env.N8N_WEBHOOK_URL ?? process.env.OPTIMA_N8N_WEBHOOK_URL ?? "").trim();
  return url || null;
}

function signingSecret(): string | null {
  const s = String(process.env.OPTIMA_N8N_SIGNING_SECRET ?? process.env.N8N_WEBHOOK_SIGNING_SECRET ?? "").trim();
  return s || null;
}

function optionalSignatureHeader(rawBody: string): Record<string, string> {
  const sec = signingSecret();
  if (!sec) return {};
  const sig = createHmac("sha256", sec).update(rawBody).digest("hex");
  return { "X-Optima-Signature": `sha256=${sig}` };
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function sendN8nEvent(payload: N8nWebhookPayload): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = getWebhookUrl();
  if (!url) {
    logAutomation({ level: "warn", event: payload.event, message: "n8n_webhook_url_missing" });
    return { ok: false, error: "N8N_WEBHOOK_URL not configured" };
  }

  const rawBody = JSON.stringify(payload);
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.N8N_WEBHOOK_SECRET
            ? { "X-Optima-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET }
            : {}),
          ...optionalSignatureHeader(rawBody),
        },
        body: rawBody,
        signal: AbortSignal.timeout(12_000),
      });

      if (res.ok) {
        logAutomation({
          level: "info",
          event: payload.event,
          message: "n8n_event_sent",
          agentId: payload.agentId,
          sessionId: payload.sessionId,
          meta: { status: res.status, attempt, signed: Boolean(signingSecret()) },
        });
        return { ok: true, status: res.status };
      }

      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }

  logAutomation({
    level: "error",
    event: payload.event,
    message: "n8n_event_failed",
    agentId: payload.agentId,
    sessionId: payload.sessionId,
    meta: { error: lastError },
  });
  return { ok: false, error: lastError };
}

/**
 * Envoi structuré (prospect / conversation / agent / action) — même endpoint, payload enrichi.
 */
export async function sendN8nStructuredEvent(
  payload: N8nStructuredPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = getWebhookUrl();
  if (!url) {
    logAutomation({ level: "warn", event: payload.event, message: "n8n_webhook_url_missing" });
    return { ok: false, error: "N8N_WEBHOOK_URL not configured" };
  }

  const rawBody = JSON.stringify(payload);
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.N8N_WEBHOOK_SECRET
            ? { "X-Optima-Webhook-Secret": process.env.N8N_WEBHOOK_SECRET }
            : {}),
          ...optionalSignatureHeader(rawBody),
        },
        body: rawBody,
        signal: AbortSignal.timeout(12_000),
      });

      if (res.ok) {
        logAutomation({
          level: "info",
          event: payload.event,
          message: "n8n_structured_event_sent",
          agentId: payload.agent.id,
          sessionId: payload.conversation.sessionId,
          meta: {
            status: res.status,
            attempt,
            actionType: payload.action.type,
            signed: Boolean(signingSecret()),
          },
        });
        return { ok: true, status: res.status };
      }

      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }

  logAutomation({
    level: "error",
    event: payload.event,
    message: "n8n_structured_event_failed",
    agentId: payload.agent.id,
    sessionId: payload.conversation.sessionId,
    meta: { error: lastError, actionType: payload.action.type },
  });
  return { ok: false, error: lastError };
}

export async function flushQueuedEventToN8n(
  row: QueuedAutomationEvent,
  ctx: ConversationAutomationContext,
): Promise<boolean> {
  incrementEventAttempt(row.id);
  markEventStatus(row.id, "processing");

  const normalized: N8nStablePayload = buildNormalizedN8nPayloadFromQueuedEvent(row, ctx);

  const rateInput = inputFromAutomationContext(ctx, {
    event: row.event,
    actionChannel: resolveActionChannelFromEvent(
      row.event,
      String(row.payload?.channel ?? ""),
    ),
    workflowSlug: String(row.payload?.workflowSlug ?? normalized.automation.workflow),
  });

  const rateGate = await canExecuteAutomationAction(rateInput);
  if (!rateGate.allowed) {
    markEventStatus(row.id, "skipped");
    return false;
  }

  const res = await dispatchN8nWebhook(normalized, {
    event: normalized.event,
    agentId: ctx.agentId,
    sessionId: ctx.sessionId,
    idempotencyKey: row.idempotencyKey,
    fallbackQueue: false,
  });

  if (res.ok) {
    await recordAutomationExecution(rateInput);
  }

  markEventStatus(row.id, res.ok ? "sent" : row.attempts >= MAX_ATTEMPTS ? "failed" : "pending");
  return res.ok;
}
