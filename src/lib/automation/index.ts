export type * from "./types";

export { buildIdempotencyKey, assertNotDuplicate, hasRecentDuplicate } from "./anti-duplicate";
export { logAutomation, getAutomationLogSnapshot } from "./event-log";
export {
  enqueueAutomationEvent,
  peekPendingEvents,
  markEventStatus,
  getQueueDepth,
} from "./event-queue";

export { deriveConversationTriggers, triggersToN8nEvents } from "./triggers/event-trigger-engine";
export { evaluateAutomationEligibility } from "./automation-eligibility-engine";
export { analyzeTriggerSignals } from "./triggers/trigger-signals";

export { decideSmartFollowup } from "./followups/smart-followup-engine";
export { canSendFollowup, pickFollowupVariant } from "./followups/anti-spam-human";

export { scheduleFollowup } from "./scheduler/smart-scheduler";

export {
  evaluateBusinessHoursForOutbound,
  isOutboundAutomationAction,
  isWithinBusinessHours,
  resolveBusinessHoursConfig,
} from "./business-hours-guard";
export type { BusinessHoursConfig, BusinessHoursGateResult } from "./business-hours-guard";

export {
  AUTOMATION_MAX_ATTEMPTS,
  computeNextRetryAtIso,
  computeRetryBackoffMs,
} from "./automation-retry";

export {
  evaluateAutonomousAutomationDecision,
  formatAutonomousDecisionForLog,
} from "./autonomous-decision-engine";
export type { AutonomousDecisionInput, AutonomousDecisionResult, AutonomousDecisionState } from "./autonomous-decision-engine";

export { detectFollowupFatigue } from "./followup-fatigue-detector";
export type { FollowupFatigueLevel, FollowupFatigueReport } from "./followup-fatigue-detector";

export {
  executeAutomationJob,
  runAutomationExecutionCycle,
  scanAndExecuteAutomationJobs,
} from "./automation-execution-engine";
export type { AutomationExecutionCycleStats, ExecuteJobResult } from "./automation-execution-engine";

export {
  inferPipelineStage,
  formatPipelineMemoryBlock,
  pipelineAllowsCommercialFollowup,
  temperatureToPipelineStage,
} from "./crm/sales-pipeline-memory";
export { toCrmLeadView } from "./crm/crm-automation-bridge";

export { evaluateCondition, evaluateAllConditions } from "./conditions/condition-evaluator";
export type { WorkflowCondition } from "./conditions/condition-evaluator";

export { syncAutomationMemory, buildAutomationStateSnapshot } from "./memory-sync/memory-sync-engine";

export { sendN8nEvent, sendN8nStructuredEvent, flushQueuedEventToN8n } from "./integrations/n8n-webhook-client";
export type { N8nWebhookPayload, N8nStructuredPayload } from "./integrations/n8n-webhook-client";

export {
  dispatchN8nWebhook,
  checkN8nHealth,
  getN8nConnectionHealth,
} from "./integrations/n8n-connection-manager";
export type { N8nConnectionHealth, N8nConnectionDispatchResult } from "./integrations/n8n-connection-manager";

export {
  WORKFLOW_REGISTRY,
  getWorkflowRegistryEntry,
  listEnabledWorkflows,
  resolveRegistryByIntent,
} from "./workflow-registry";
export type { WorkflowRegistryEntry, WorkflowRegistryChannel } from "./workflow-registry";

export {
  buildNormalizedN8nPayload,
  buildN8nProductionPayload,
  buildHotProspectPayload,
  buildNormalizedN8nPayloadFromQueuedEvent,
  resolveStableConversationId,
  resolveScheduledForIso,
  conversationContextFromQueuePayload,
} from "./payloads/n8n-production-payload";
export type { N8nStablePayload, N8nProductionPayload } from "./payloads/n8n-production-payload";

export {
  mapJobStatusToDeliveryStatus,
  mapN8nRunStatusToDelivery,
} from "./automation-delivery-status";
export type { AutomationDeliveryStatus } from "./automation-delivery-status";

export { scheduleAutomationDelay } from "./scheduler/automation-scheduler";
export type { AutomationDelayPreset, AutomationScheduleResult } from "./scheduler/automation-scheduler";

export { planWhatsappFollowup } from "./whatsapp/whatsapp-followup-adapter";
export type { WhatsappFollowupPlan, WhatsappFollowupAdapterInput } from "./whatsapp/whatsapp-followup-adapter";

export {
  sendProductRecapEmail,
  sendFollowupEmail,
  sendQuoteEmail,
  sendWelcomeEmail,
  sendAbandonedConversationEmail,
  sendHotLeadEmail,
} from "./email/email-automation-engine";
export type { EmailAutomationKind, EmailAutomationDraft } from "./email/email-automation-engine";

export {
  canExecuteAutomationAction,
  recordAutomationExecution,
  checkAutomationRateLimit,
  inputFromAutomationContext,
  resolveActionChannelFromEvent,
} from "./rate-limit/automation-rate-limiter";
export type {
  CanExecuteAutomationResult,
  AutomationRateLimitInput,
} from "./rate-limit/automation-rate-limiter";
export type { AutomationActionChannel } from "./rate-limit/cooldown-engine";

export {
  analyzeAutomationIntents,
  topAutomationIntent,
} from "./automation-intent-engine";
export type {
  AutomationActionType,
  AutomationIntentSignal,
  AutomationIntentPriorityBand,
} from "./automation-intent-engine";

export { evaluateAutomationSafety } from "./automation-safety";
export type { AutomationSafetyResult, AutomationSafetyInput } from "./automation-safety";

export { buildHumanApprovalCard } from "./human-approval-mode";
export type { HumanApprovalChoice, HumanApprovalCard } from "./human-approval-mode";

export {
  computeLeadPriorityScore,
  isHotAutoBypassAction,
  leadBandFromScore,
  softFallbackCopy,
  SOFT_ACK_FALLBACK_EN,
  SOFT_ACK_FALLBACK_ES,
  SOFT_ACK_FALLBACK_FR,
} from "./automation-priority-engine";
export type { LeadPriorityBand, LeadPriorityFactors, LeadPriorityResult } from "./automation-priority-engine";

export {
  enqueueAutomationAction,
  scheduleAutomationAction,
  peekPendingAutomationJobs,
  peekRunnableAutomationJobs,
  peekAwaitingHumanJobs,
  getAutomationJob,
  resolveAutomationJobHumanApproval,
  processAutomationActionJob,
  flushPendingAutomationJobs,
  getAutomationActionQueueDepth,
  isAutomationDispatchSuccessStatus,
  sweepAwaitingHumanSoftFallback,
  appendAutomationJobLog,
  setAutomationJobStatus,
  listAllAutomationJobs,
} from "./action-queue";
export type { AutomationActionJob, AutomationActionJobStatus, AutomationExecutionPath } from "./action-queue";

export {
  DOCUMENTED_BUSINESS_EVENTS,
  isBusinessEventName,
  deriveBusinessEvents,
} from "./business-events";

export {
  detectAssistantEmailOffer,
  extractEmailFromUserMessage,
  planSmartEmailFollowup,
  enqueueSmartEmailFollowupSideEffects,
} from "./smart-email-followup-flow";
export type { SmartEmailFollowupPlan } from "./smart-email-followup-flow";

export type {
  AutomationJobDetailDTO,
  AutomationJobLifecycleStatus,
  AutomationPendingItemDTO,
  AutomationPendingListDTO,
  AutomationSupervisionActionKindUi,
} from "./supervision-dto-types";

export type {
  AutomationExecutionState,
  AutomationExecutionRecord,
  ExecutionTransitionRecord,
  ExecuteAutomationIntentResult,
  ExecutionChannel,
} from "./execution-types";

export {
  createAutomationExecutionRecord,
  assertTransitionAllowed,
  transitionAutomationExecution,
  registerAutomationExecution,
  getAutomationExecutionRecord,
  snapshotRecentAutomationExecutions,
} from "./automation-state-machine";

export { executeAutomationIntent } from "./execution-orchestrator";
export type { ExecuteAutomationIntentInput } from "./execution-orchestrator";

export { resolveWorkflowRoute, mapAutomationIntentToAgentActionKind, registerWorkflowRoute } from "./workflow-mapper";
export type { WorkflowRoute, WorkflowRoutingHint } from "./workflow-mapper";

export { resolveExecutionChannel } from "./channel-router";
export type { ChannelAvailability, ChannelRouterInput } from "./channel-router";

export { evaluateBusinessRules } from "./business-rules-engine";
export type { BusinessRulesResult } from "./business-rules-engine";

export { appendAgentReasoningLog, getAgentReasoningLogs, getAgentReasoningLogsByExecution } from "./agent-reasoning-log";
export type { AgentReasoningEntry } from "./agent-reasoning-log";

export { formatLiveExecutionFeedback } from "./execution-feedback";
export type { LiveExecutionOutcome } from "./execution-feedback";

export { logExecutionObs } from "./execution-observability";

export { draftWhatsappFollowup, triggerToWhatsappKind } from "./whatsapp/whatsapp-followup-engine";
export { draftAutomationEmail } from "./email/email-automation";

export { AUTO_ACTION_REGISTRY, suggestAutoActions } from "./workflows/auto-actions";
export { processConversationAutomation } from "./workflows/conversation-automation";
export type { ConversationAutomationResult } from "./workflows/conversation-automation";
