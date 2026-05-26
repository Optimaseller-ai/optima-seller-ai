import "server-only";

import { scheduleFollowup } from "@/lib/automation/scheduler/smart-scheduler";
import type { AutomationTriggerKind, ConversationAutomationContext } from "@/lib/automation/types";
import type { LeadTemperature } from "@/lib/prospect/lead-profile/prospect-profile";
import { snapUtcInstantOutOfQuietHours } from "@/lib/agents/timing/quiet-hours";
import { DateTime } from "luxon";

/**
 * Relances contextualisées — chaud court délai, hésitant lendemain slot calme.
 */
export function scheduleSmartAgentFollowup(args: {
  ctx: ConversationAutomationContext;
  trigger: AutomationTriggerKind;
  leadTemperature?: LeadTemperature;
  hesitant?: boolean;
  prospectAngry?: boolean;
}): { scheduledFor: string; reason: string } {
  const tz = args.ctx.businessIanaTimezone?.trim() || "Africa/Douala";

  if (args.hesitant === true) {
    const base = scheduleFollowup({
      ctx: args.ctx,
      trigger: "gentle_nurture",
      prospectAngry: args.prospectAngry,
    });
    let ms = Date.parse(base.scheduledFor);
    const tomorrowEvening = DateTime.now()
      .setZone(tz)
      .plus({ days: 1 })
      .set({ hour: 19, minute: 15, second: 0, millisecond: 0 });
    ms = Math.max(ms, tomorrowEvening.toUTC().toMillis());
    ms = snapUtcInstantOutOfQuietHours(ms, tz);
    return {
      scheduledFor: new Date(ms).toISOString(),
      reason: "hesitant_next_evening_band",
    };
  }

  if (args.leadTemperature === "hot" || args.leadTemperature === "ready_to_buy") {
    const ms = snapUtcInstantOutOfQuietHours(Date.now() + 60 * 60_000, tz);
    return {
      scheduledFor: new Date(ms).toISOString(),
      reason: "hot_followup_1h_snapped",
    };
  }

  const d = scheduleFollowup({
    ctx: args.ctx,
    trigger: args.trigger,
    prospectAngry: args.prospectAngry,
  });
  return { scheduledFor: d.scheduledFor, reason: d.reason };
}
