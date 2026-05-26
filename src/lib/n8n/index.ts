export type {
  N8nWorkflowKind,
  N8nWorkflowRunStatus,
  N8nIntentKey,
  N8nDispatchPayload,
  N8nCallbackPayload,
} from "./events/n8n-event-types";

export {
  mapIntentToWorkflow,
  mapAutomationIntentToWorkflow,
  registerWorkflowMapping,
  listWorkflowMappings,
} from "./mapping/workflow-mapping-engine";
export type { WorkflowMapping } from "./mapping/workflow-mapping-engine";

export { dispatchN8nAction } from "./dispatch/n8n-action-dispatcher";
export type { N8nDispatchResult } from "./dispatch/n8n-action-dispatcher";

export {
  handleN8nCallback,
  handleN8nHumanApprovalCallback,
  parseN8nCallbackBody,
} from "./dispatch/n8n-response-handler";

export {
  validateInboundN8nWebhook,
  signN8nPayload,
  buildOutboundSignatureHeaders,
} from "./security/n8n-webhook-security";

export {
  createWorkflowRun,
  getWorkflowRun,
  getWorkflowRunByJobId,
  listWorkflowRuns,
  getWorkflowRunStats,
  transitionWorkflowRun,
} from "./workflows/workflow-status-tracker";
export type { WorkflowRunRecord } from "./workflows/workflow-status-tracker";

export { resumeWorkflowAfterHumanApproval } from "./workflows/human-approval-bridge";

export {
  schedulePresetAutomation,
  scheduleCustomAutomation,
  enqueueImmediateN8nAction,
  listScheduledPresets,
} from "./workflows/scheduled-automation-engine";
export type { ScheduledAutomationPreset } from "./workflows/scheduled-automation-engine";

export {
  executeN8nJobFromQueue,
  runN8nExecutionCycle,
  orchestrateIntentToN8n,
  ingestN8nWebhookCallback,
  executeN8nJobById,
} from "./n8n-execution-engine";

export { planN8nRetry, getN8nMaxAttempts, shouldRetryN8nDispatch } from "./retry/n8n-retry-policy";
