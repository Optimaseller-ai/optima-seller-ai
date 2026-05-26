/**
 * Smart Followup Engine — quand relancer, comment, quand arrêter.
 */

import { canSendFollowup } from "./anti-spam-human";
import { scheduleFollowup } from "../scheduler/smart-scheduler";
import { pipelineAllowsCommercialFollowup } from "../crm/sales-pipeline-memory";
import { analyzeTriggerSignals } from "../triggers/trigger-signals";
import type {
  AutomationTrigger,
  ConversationAutomationContext,
  SmartFollowupDecision,
} from "../types";

function primaryTrigger(triggers: AutomationTrigger[]): AutomationTrigger | null {
  const commercial = triggers.filter((t) => t.kind !== "no_commercial_push" && t.kind !== "sav_ticket");
  return commercial[0] ?? triggers[0] ?? null;
}

/**
 * Décide si une relance doit être planifiée pour ce fil.
 */
export function decideSmartFollowup(
  ctx: ConversationAutomationContext,
  triggers: AutomationTrigger[],
): SmartFollowupDecision {
  const signals = analyzeTriggerSignals(ctx);
  const stage = ctx.pipelineStage ?? "new_lead";
  const top = primaryTrigger(triggers);

  if (!top) {
    return {
      shouldFollowUp: false,
      channel: "chat",
      trigger: null,
      scheduledFor: null,
      stopReason: "no_trigger",
    };
  }

  if (top.kind === "no_commercial_push" || signals.prospectAngry) {
    return {
      shouldFollowUp: false,
      channel: "chat",
      trigger: top.kind,
      scheduledFor: null,
      stopReason: "prospect_angry_or_complaint",
    };
  }

  if (!pipelineAllowsCommercialFollowup(stage)) {
    return {
      shouldFollowUp: false,
      channel: "chat",
      trigger: top.kind,
      scheduledFor: null,
      stopReason: `pipeline_${stage}`,
    };
  }

  const spam = canSendFollowup(ctx, top.kind);
  if (!spam.allowed) {
    return {
      shouldFollowUp: false,
      channel: top.channel ?? "chat",
      trigger: top.kind,
      scheduledFor: null,
      stopReason: spam.reason,
    };
  }

  const schedule = scheduleFollowup({
    ctx,
    trigger: top.kind,
    prospectAngry: signals.prospectAngry,
  });

  return {
    shouldFollowUp: true,
    channel: top.channel ?? "chat",
    trigger: top.kind,
    scheduledFor: schedule.scheduledFor,
    messageHint: top.reason,
  };
}
