/**
 * Évaluation de conditions pour workflows automation.
 */

import type { AutomationTrigger, ConversationAutomationContext, SalesPipelineStage } from "../types";
import { analyzeTriggerSignals } from "../triggers/trigger-signals";

export type WorkflowCondition =
  | { type: "pipeline_stage"; stage: SalesPipelineStage | SalesPipelineStage[] }
  | { type: "lead_temperature"; min: "cold" | "warm" | "hot" | "ready_to_buy" }
  | { type: "not_angry" }
  | { type: "relance_under"; max: number }
  | { type: "has_email" }
  | { type: "trigger_is"; kind: AutomationTrigger["kind"] };

const TEMP_ORDER = ["cold", "warm", "hot", "ready_to_buy"] as const;

function tempIndex(t: string): number {
  const i = TEMP_ORDER.indexOf(t as (typeof TEMP_ORDER)[number]);
  return i >= 0 ? i : 0;
}

export function evaluateCondition(cond: WorkflowCondition, ctx: ConversationAutomationContext): boolean {
  const signals = analyzeTriggerSignals(ctx);
  const stage = ctx.pipelineStage ?? "new_lead";
  const relance = ctx.relanceCount ?? 0;

  switch (cond.type) {
    case "pipeline_stage": {
      const stages = Array.isArray(cond.stage) ? cond.stage : [cond.stage];
      return stages.includes(stage);
    }
    case "lead_temperature": {
      const cur = ctx.leadTemperature ?? ctx.prospectLead?.leadTemperature ?? "cold";
      return tempIndex(cur) >= tempIndex(cond.min);
    }
    case "not_angry":
      return !signals.prospectAngry;
    case "relance_under":
      return relance < cond.max;
    case "has_email":
      return Boolean(ctx.prospectLead?.email?.trim());
    case "trigger_is":
      return true;
    default:
      return false;
  }
}

export function evaluateAllConditions(conditions: WorkflowCondition[], ctx: ConversationAutomationContext): boolean {
  return conditions.every((c) => evaluateCondition(c, ctx));
}
