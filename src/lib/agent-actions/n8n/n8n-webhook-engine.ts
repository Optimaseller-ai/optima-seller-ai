import "server-only";

import { sendN8nEvent } from "@/lib/automation/integrations/n8n-webhook-client";
import type { AutomationEventName } from "@/lib/automation/types";
import { withRetry } from "../retry/retry-engine";
import { logAgentAutomation } from "../logging/automation-logs";

export type N8nEmitArgs = {
  event: AutomationEventName;
  agentId: string;
  sessionId: string;
  conversationId?: string | null;
  trigger?: string;
  pipelineStage?: string;
  leadTemperature?: string;
  data?: Record<string, unknown>;
};

/**
 * Couche n8n dédiée Agent Actions — événements métier normalisés.
 * Ex. lead.created, lead.hot, customer.returning, quote.requested, payment.pending…
 */
export async function emitAgentN8nWebhook(args: N8nEmitArgs): Promise<{ ok: boolean; error?: string }> {
  const wrapped = await withRetry(
    async () => {
      const res = await sendN8nEvent({
        event: args.event,
        timestamp: new Date().toISOString(),
        agentId: args.agentId,
        sessionId: args.sessionId,
        conversationId: args.conversationId,
        trigger: args.trigger,
        pipelineStage: args.pipelineStage,
        leadTemperature: args.leadTemperature,
        data: args.data,
      });
      if (!res.ok) throw new Error(res.error ?? "n8n_emit_failed");
      return res;
    },
    {
      maxAttempts: 3,
      baseDelayMs: 1200,
      backoffFactor: 2,
      isRetryable: (e) => !/not configured|400|401|403/.test(String(e)),
    },
  );

  if (!wrapped.ok) {
    logAgentAutomation({
      level: "error",
      message: "n8n_emit_exhausted",
      agentId: args.agentId,
      sessionId: args.sessionId,
      event: args.event,
      meta: { error: wrapped.error, attempts: wrapped.attempts },
    });
    return { ok: false, error: wrapped.error };
  }

  logAgentAutomation({
    level: "info",
    message: "n8n_emit_ok",
    agentId: args.agentId,
    sessionId: args.sessionId,
    event: args.event,
    workflow: "n8n",
    result: "ok",
    retries: wrapped.attempts > 1 ? wrapped.attempts - 1 : 0,
  });
  return { ok: true };
}
