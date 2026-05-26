import "server-only";

import type { AgentActionRequest, AgentActionResult } from "../context/agent-action-types";
import type { AutomationEventName } from "@/lib/automation/types";
import { emitAgentN8nWebhook } from "../n8n/n8n-webhook-engine";
import { formatAutomationPersonalityLockBlock } from "../permissions/agent-personality-consistency";

function pickEvent(kind: AgentActionRequest["kind"], payload?: Record<string, unknown>): AutomationEventName {
  switch (kind) {
    case "create_quote":
      return "quote.requested";
    case "request_payment":
      return "payment.pending";
    case "book_delivery":
      return "delivery.requested";
    case "create_order":
      return "purchase.intent";
    case "notify_human":
      return "followup.required";
    case "send_catalog":
      return "purchase.intent";
    case "send_email":
    case "send_whatsapp_followup":
    case "schedule_reminder":
      return "followup.required";
    case "emit_workflow_event": {
      const ev = String(payload?.event ?? "").trim();
      if (!ev) return "followup.required";
      return ev as AutomationEventName;
    }
    default:
      return "followup.required";
  }
}

function correlationFrom(req: AgentActionRequest) {
  const base = [req.kind, req.sessionId, req.idempotencyKey ?? ""].join("|");
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `aac_${h.toString(36)}`;
}

/**
 * Exécuteurs — aujourd’hui : bus n8n + méta canal pour implémentations futures (WhatsApp Cloud, email SMTP, voix).
 */
export async function dispatchAgentAction(req: AgentActionRequest): Promise<AgentActionResult> {
  const correlationId = correlationFrom(req);
  const personalityHint = formatAutomationPersonalityLockBlock(req.personaKey);

  if (req.kind === "emit_workflow_event") {
    const event = pickEvent(req.kind, req.payload);
    const res = await emitAgentN8nWebhook({
      event,
      agentId: req.agentId,
      sessionId: req.sessionId,
      conversationId: req.conversationId,
      trigger: typeof req.payload?.trigger === "string" ? req.payload.trigger : "emit_workflow_event",
      data: {
        ...req.payload,
        userId: req.userId,
        personalityHint,
      },
    });
    return res.ok ? { ok: true, correlationId, channel: "n8n" } : { ok: false, correlationId, error: res.error };
  }

  const event = pickEvent(req.kind, req.payload);

  const channel =
    req.kind === "send_whatsapp_followup"
      ? "whatsapp_cloud"
      : req.kind === "send_email"
        ? "email"
        : req.kind === "book_delivery"
          ? "calendar"
          : undefined;

  const res = await emitAgentN8nWebhook({
    event,
    agentId: req.agentId,
    sessionId: req.sessionId,
    conversationId: req.conversationId,
    trigger: req.kind,
    data: {
      actionKind: req.kind,
      channel,
      agentName: req.agentName,
      userId: req.userId,
      personalityHint,
      ...req.payload,
    },
  });

  if (!res.ok) return { ok: false, correlationId, error: res.error, channel: "n8n" };
  return { ok: true, correlationId, channel: "n8n" };
}
