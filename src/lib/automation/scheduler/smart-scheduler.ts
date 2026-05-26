/**
 * Smart Scheduler — meilleur moment pour relancer (fuseau + habitudes).
 */

import { DateTime } from "luxon";
import { snapUtcInstantOutOfQuietHours } from "@/lib/agents/timing/quiet-hours";
import type { AutomationTriggerKind, ConversationAutomationContext, SalesPipelineStage } from "../types";

export type ScheduleSlot = "morning" | "afternoon" | "evening";

export type ScheduleDecision = {
  scheduledFor: string;
  slot: ScheduleSlot;
  reason: string;
};

function inferPreferredSlot(ctx: ConversationAutomationContext): ScheduleSlot {
  const last = ctx.lastProspectActiveAt ?? ctx.conversationState?.stats?.last_active_at;
  if (!last) return "evening";
  const tz = ctx.businessIanaTimezone?.trim() || "Africa/Douala";
  const h = DateTime.fromMillis(last, { zone: "utc" }).setZone(tz).hour;
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  return "evening";
}

function delayMinutesForTrigger(
  trigger: AutomationTriggerKind,
  stage: SalesPipelineStage,
  angry: boolean,
): number {
  if (angry || trigger === "no_commercial_push") return 24 * 60;
  if (trigger === "closing_sequence" || stage === "ready_to_buy" || stage === "hot") return 45;
  if (trigger === "quotation_followup") return 90;
  if (trigger === "soft_relaunch") return 2 * 60;
  if (trigger === "gentle_nurture") return 24 * 60;
  if (trigger === "message_received") return 6 * 60;
  if (trigger === "interest_signal") return 90;
  if (trigger === "checkout_started") return 40;
  return 3 * 60;
}

function snapToSlot(baseMs: number, slot: ScheduleSlot, tz: string): number {
  const dt = DateTime.fromMillis(baseMs, { zone: "utc" }).setZone(tz);
  const hour = slot === "morning" ? 10 : slot === "afternoon" ? 15 : 19;
  let target = dt.set({ hour, minute: 5, second: 0, millisecond: 0 });
  if (target.toMillis() <= Date.now()) target = target.plus({ days: 1 });
  return snapUtcInstantOutOfQuietHours(target.toUTC().toMillis(), tz);
}

/**
 * Choisit l’instant de relance (ISO UTC) selon température, émotion et trigger.
 */
export function scheduleFollowup(args: {
  ctx: ConversationAutomationContext;
  trigger: AutomationTriggerKind;
  prospectAngry?: boolean;
  from?: Date;
}): ScheduleDecision {
  const from = args.from ?? new Date();
  const tz = args.ctx.businessIanaTimezone?.trim() || "Africa/Douala";
  const stage = args.ctx.pipelineStage ?? "interested";
  const slot = inferPreferredSlot(args.ctx);
  const minutes = delayMinutesForTrigger(args.trigger, stage, args.prospectAngry === true);
  let atMs = from.getTime() + minutes * 60_000;
  atMs = snapToSlot(atMs, slot, tz);
  atMs = snapUtcInstantOutOfQuietHours(atMs, tz);

  return {
    scheduledFor: new Date(atMs).toISOString(),
    slot,
    reason: `trigger=${args.trigger} delay=${minutes}m slot=${slot}`,
  };
}
