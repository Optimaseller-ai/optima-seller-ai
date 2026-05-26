import "server-only";

import type { AgentActionRequest, AgentActionResult } from "../context/agent-action-types";
import {
  evaluateAgentActionDuplicate,
  evaluateAgentActionSafety,
} from "./action-safety-layer";
import { evaluateHumanApprovalGate } from "../permissions/human-approval-gate";
import { dispatchAgentAction } from "../executors/agent-action-executors";
import { recordWorkflowMemory } from "../workflow-triggers/workflow-memory";
import { logAgentAutomation } from "../logging/automation-logs";

function digestPayload(payload?: Record<string, unknown>) {
  try {
    const s = JSON.stringify(payload ?? {});
    return `${s.length}_${s.slice(0, 48)}`;
  } catch {
    return "0";
  }
}

/**
 * Point d’entrée unique — sécurité → validation humaine → exécution → mémoire → logs.
 */
export async function executeAgentAction(req: AgentActionRequest): Promise<AgentActionResult> {
  const dup = evaluateAgentActionDuplicate({
    sessionId: req.sessionId,
    idempotencyKey: req.idempotencyKey,
  });
  if (!dup.ok) {
    recordWorkflowMemory({
      sessionId: req.sessionId,
      prospectId: typeof req.payload?.prospectId === "string" ? req.payload.prospectId : null,
      kind: req.kind,
      workflow: "agent_action_engine",
      result: "skipped",
      detail: "duplicate",
      payloadDigest: digestPayload(req.payload),
    });
    logAgentAutomation({
      level: "warn",
      message: "action_duplicate_blocked",
      agentId: req.agentId,
      sessionId: req.sessionId,
      action: req.kind,
    });
    return { ok: false, error: "duplicate_action", channel: "internal" };
  }

  const approval = evaluateHumanApprovalGate({
    kind: req.kind,
    humanApproved: req.humanApproved,
    payload: req.payload,
  });
  if (approval.required) {
    recordWorkflowMemory({
      sessionId: req.sessionId,
      prospectId: typeof req.payload?.prospectId === "string" ? req.payload.prospectId : null,
      kind: req.kind,
      workflow: "human_approval",
      result: "pending_approval",
      detail: approval.reason,
      payloadDigest: digestPayload(req.payload),
    });
    logAgentAutomation({
      level: "info",
      message: "action_pending_human_approval",
      agentId: req.agentId,
      sessionId: req.sessionId,
      action: req.kind,
      meta: { pendingApprovalId: approval.pendingApprovalId, reason: approval.reason },
    });
    return { ok: false, pendingApprovalId: approval.pendingApprovalId, channel: "internal" };
  }

  const safety = evaluateAgentActionSafety({
    sessionId: req.sessionId,
    agentId: req.agentId,
    actionKind: req.kind,
    businessIanaTimezone: req.businessIanaTimezone ?? (req.payload?.businessIanaTimezone as string | undefined),
    bypassQuietHours: req.payload?.bypassQuietHours === true,
  });
  if (!safety.ok) {
    recordWorkflowMemory({
      sessionId: req.sessionId,
      prospectId: typeof req.payload?.prospectId === "string" ? req.payload.prospectId : null,
      kind: req.kind,
      workflow: "agent_action_engine",
      result: "skipped",
      detail: safety.reason,
      payloadDigest: digestPayload(req.payload),
    });
    logAgentAutomation({
      level: "warn",
      message: `action_safety_${safety.reason}`,
      agentId: req.agentId,
      sessionId: req.sessionId,
      action: req.kind,
    });
    return { ok: false, error: safety.reason, channel: "internal" };
  }

  logAgentAutomation({
    level: "info",
    message: "action_dispatch_start",
    agentId: req.agentId,
    sessionId: req.sessionId,
    action: req.kind,
  });

  const out = await dispatchAgentAction(req);

  recordWorkflowMemory({
    sessionId: req.sessionId,
    prospectId: typeof req.payload?.prospectId === "string" ? req.payload.prospectId : null,
    kind: req.kind,
    workflow: "agent_action_engine",
    result: out.ok ? "ok" : "failed",
    detail: out.error,
    correlationId: out.correlationId,
    payloadDigest: digestPayload(req.payload),
  });

  logAgentAutomation({
    level: out.ok ? "info" : "error",
    message: out.ok ? "action_dispatch_ok" : "action_dispatch_failed",
    agentId: req.agentId,
    sessionId: req.sessionId,
    action: req.kind,
    meta: { correlationId: out.correlationId, error: out.error },
  });

  return out;
}
