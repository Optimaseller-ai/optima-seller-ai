/**
 * N8N Connection Manager — connexion webhook, retry, timeout, santé, signature, fallback.
 */

import "server-only";

import { logAutomation } from "../event-log";
import { enqueueAutomationEvent } from "../event-queue";
import type { AutomationEventName } from "../types";
import { buildOutboundSignatureHeaders } from "@/lib/n8n/security/n8n-webhook-security";
import {
  getN8nMaxAttempts,
  getN8nRequestTimeoutMs,
  planN8nRetry,
  shouldRetryN8nDispatch,
} from "@/lib/n8n/retry/n8n-retry-policy";

export type N8nConnectionHealth = {
  configured: boolean;
  lastCheckAt: string | null;
  lastOk: boolean | null;
  lastLatencyMs: number | null;
  lastError: string | null;
  consecutiveFailures: number;
};

export type N8nDispatchOptions = {
  event: AutomationEventName | string;
  agentId?: string;
  sessionId?: string;
  /** Si true, enqueue l’événement en file locale si le webhook échoue définitivement. */
  fallbackQueue?: boolean;
  idempotencyKey?: string;
};

const health: N8nConnectionHealth = {
  configured: false,
  lastCheckAt: null,
  lastOk: null,
  lastLatencyMs: null,
  lastError: null,
  consecutiveFailures: 0,
};

function getWebhookUrl(): string | null {
  const url = String(process.env.N8N_WEBHOOK_URL ?? process.env.OPTIMA_N8N_WEBHOOK_URL ?? "").trim();
  health.configured = Boolean(url);
  return url || null;
}

function touchHealth(ok: boolean, latencyMs: number, error?: string) {
  health.lastCheckAt = new Date().toISOString();
  health.lastOk = ok;
  health.lastLatencyMs = latencyMs;
  health.lastError = error ?? null;
  if (ok) health.consecutiveFailures = 0;
  else health.consecutiveFailures += 1;
}

export function getN8nConnectionHealth(): N8nConnectionHealth {
  getWebhookUrl();
  return { ...health };
}

/**
 * Ping léger du webhook (POST minimal) — pour supervision / cron santé.
 */
export async function checkN8nHealth(): Promise<N8nConnectionHealth> {
  const url = getWebhookUrl();
  if (!url) {
    touchHealth(false, 0, "N8N_WEBHOOK_URL not configured");
    return getN8nConnectionHealth();
  }

  const t0 = Date.now();
  const body = JSON.stringify({ event: "health.ping", timestamp: new Date().toISOString() });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildOutboundSignatureHeaders(body),
      },
      body,
      signal: AbortSignal.timeout(Math.min(getN8nRequestTimeoutMs(), 8_000)),
    });
    const latency = Date.now() - t0;
    touchHealth(res.ok, latency, res.ok ? undefined : `HTTP ${res.status}`);
  } catch (e) {
    touchHealth(false, Date.now() - t0, e instanceof Error ? e.message : String(e));
  }
  return getN8nConnectionHealth();
}

export type N8nConnectionDispatchResult = {
  ok: boolean;
  status?: number;
  error?: string;
  attempts: number;
  fallbackQueued?: boolean;
};

/**
 * Envoi webhook avec retry exponentiel, timeout, signature HMAC.
 */
export async function dispatchN8nWebhook(
  payload: Record<string, unknown>,
  opts: N8nDispatchOptions,
): Promise<N8nConnectionDispatchResult> {
  const url = getWebhookUrl();
  if (!url) {
    const err = "N8N_WEBHOOK_URL not configured";
    logAutomation({
      level: "warn",
      event: opts.event as AutomationEventName,
      message: "n8n_connection_not_configured",
      agentId: opts.agentId,
      sessionId: opts.sessionId,
    });
    return { ok: false, error: err, attempts: 0 };
  }

  const rawBody = JSON.stringify(payload);
  const maxAttempts = getN8nMaxAttempts();
  const timeoutMs = getN8nRequestTimeoutMs();
  let lastError = "";
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildOutboundSignatureHeaders(rawBody),
        },
        body: rawBody,
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastStatus = res.status;
      if (res.ok) {
        touchHealth(true, 0);
        logAutomation({
          level: "info",
          event: opts.event as AutomationEventName,
          message: "n8n_connection_dispatch_ok",
          agentId: opts.agentId,
          sessionId: opts.sessionId,
          meta: { status: res.status, attempt },
        });
        return { ok: true, status: res.status, attempts: attempt };
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    if (!shouldRetryN8nDispatch(attempt, lastError)) break;
    const plan = planN8nRetry(attempt);
    await new Promise<void>((r) => setTimeout(r, plan.delayMs));
  }

  touchHealth(false, 0, lastError);
  logAutomation({
    level: "error",
    event: opts.event as AutomationEventName,
    message: "n8n_connection_dispatch_failed",
    agentId: opts.agentId,
    sessionId: opts.sessionId,
    meta: { error: lastError, status: lastStatus, attempts: maxAttempts },
  });

  let fallbackQueued = false;
  if (opts.fallbackQueue !== false) {
    enqueueAutomationEvent({
      event: opts.event as AutomationEventName,
      idempotencyParts: [opts.idempotencyKey ?? "fallback", opts.event, opts.sessionId ?? ""],
      payload: { ...payload, _fallback: true },
    });
    fallbackQueued = true;
    logAutomation({
      level: "warn",
      event: opts.event as AutomationEventName,
      message: "n8n_connection_fallback_queued",
      agentId: opts.agentId,
      sessionId: opts.sessionId,
    });
  }

  return {
    ok: false,
    status: lastStatus,
    error: lastError,
    attempts: maxAttempts,
    fallbackQueued,
  };
}
