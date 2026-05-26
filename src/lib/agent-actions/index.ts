/**
 * OPTIMA — Agent Actions (workflows, n8n, relances, garde-fous humains).
 * Extension naturelle : WhatsApp Cloud API, voix, réservation agenda, centre d’appels multi-canal.
 */

export type { AgentActionKind, AgentActionRequest, AgentActionResult, AgentN8nEventName } from "./context/agent-action-types";

export { executeAgentAction } from "./action-engine/agent-action-engine";
export {
  evaluateAgentActionDuplicate,
  evaluateAgentActionSafety,
  isWithinAgentActionQuietHours,
} from "./action-engine/action-safety-layer";

export { emitAgentN8nWebhook } from "./n8n/n8n-webhook-engine";
export { scheduleSmartAgentFollowup } from "./scheduler/followup-scheduler";

export {
  evaluateHumanApprovalGate,
  payloadLooksMassBroadcast,
  peekPendingApprovalKind,
  resolvePendingApproval,
} from "./permissions/human-approval-gate";
export {
  formatAutomationPersonalityLockBlock,
  resolveAgentPersonaVoice,
} from "./permissions/agent-personality-consistency";

export { recordWorkflowMemory, getWorkflowMemory, lastWorkflowMemoryOfKind } from "./workflow-triggers/workflow-memory";
export { logAgentAutomation } from "./logging/automation-logs";
export { withRetry } from "./retry/retry-engine";
export { dispatchAgentAction } from "./executors/agent-action-executors";

export type { QueuedAgentAction, DeferredAgentChannel } from "./queues/agent-action-queue";
