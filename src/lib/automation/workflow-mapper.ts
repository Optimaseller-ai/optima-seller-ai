/**
 * Mapping intentions → workflows n8n / bus (extensible).
 * Délègue au registre canonique `src/lib/n8n/mapping/workflow-mapping-engine`.
 */

import type { AgentActionKind } from "@/lib/agent-actions/context/agent-action-types";
import {
  mapAutomationIntentToWorkflow,
  mapIntentToWorkflow,
  registerWorkflowMapping,
} from "@/lib/n8n/mapping/workflow-mapping-engine";
import type { AutomationActionType, AutomationIntentSignal } from "./automation-intent-engine";
import type { AutomationEventName } from "./types";

/** Clés métier additionnelles (bus externe, triggers). */
export type WorkflowRoutingHint = AutomationActionType | "FOLLOWUP_REQUIRED" | "ORDER_STARTED" | "NOTIFY_HUMAN";

export type WorkflowRoute = {
  workflowKey: string;
  event: AutomationEventName;
};

export function resolveWorkflowRoute(intent: AutomationIntentSignal | { actionType: WorkflowRoutingHint; suggestedWorkflow?: string }): WorkflowRoute {
  const mapped =
    "confidence" in intent
      ? mapAutomationIntentToWorkflow(intent as AutomationIntentSignal)
      : mapIntentToWorkflow({
          actionType: intent.actionType,
          suggestedWorkflow: intent.suggestedWorkflow,
        });
  return {
    workflowKey: mapped.workflowSlug,
    event: mapped.event,
  };
}

/** Alignement gate actions agents (`human-approval-gate`, `agent-action-engine`). */
export function mapAutomationIntentToAgentActionKind(actionType: AutomationActionType): AgentActionKind {
  switch (actionType) {
    case "SEND_PRODUCT_EMAIL":
    case "COLLECT_EMAIL_AND_SEND_DETAILS":
      return "send_email";
    case "SEND_WHATSAPP_FOLLOWUP":
      return "send_whatsapp_followup";
    case "REQUEST_QUOTE_DETAILS":
      return "create_quote";
    case "SCHEDULE_REMINDER":
      return "schedule_reminder";
    case "ESCALATE_TO_HUMAN":
      return "notify_human";
    case "CREATE_ORDER_DRAFT":
      return "create_order";
    case "SEND_CATALOG_LINK":
      return "send_catalog";
    default:
      return "emit_workflow_event";
  }
}

/** Permet d’enregistrer des routes runtime (tests / plugins). */
export function registerWorkflowRoute(key: string, route: WorkflowRoute) {
  registerWorkflowMapping(key, {
    intent: key as never,
    workflowKind: "generic_automation",
    workflowSlug: route.workflowKey,
    event: route.event,
    requiresApprovalDefault: false,
  });
}
